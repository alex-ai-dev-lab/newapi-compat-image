// Package errornorm normalizes upstream errors before they reach the client.
// This module implements compat.RelayHook.OnClientResponseError.
package errornorm

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/compat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

// Hook implements compat.RelayHook for upstream error normalization.
type Hook struct {
	compat.NoOpRelayHook
}

// New returns a new error normalization hook.
func New() *Hook {
	return &Hook{}
}

func (h *Hook) Name() string { return "errornorm" }

func (h *Hook) OnClientResponseError(c *gin.Context, info *relaycommon.RelayInfo, err *types.NewAPIError) *types.NewAPIError {
	if err == nil || !shouldNormalize(info) {
		return err
	}
	status := err.StatusCode
	if status == 0 {
		status = http.StatusInternalServerError
	}
	original := err.MaskSensitiveErrorWithStatusCode()
	if original != "" {
		common.SysLog(fmt.Sprintf("normalized upstream error for client: channel=%d status=%d original=%s",
			channelIDForLog(info), status, common.LocalLogPreview(original)))
	}

	// DB rule first; fall back to built-in FixedMessage.
	if rule := matchRuleFromContext(info, status, original); rule != nil {
		applyRule(err, rule, status)
		compat.GetMetrics().ErrorNormalizeHit.Add(1)
		return err
	}

	err.SetMessage(FixedMessage(status))
	compat.GetMetrics().ErrorNormalizeHit.Add(1)
	return err
}

// matchRuleFromContext queries the global Store using channel-derived platform string.
func matchRuleFromContext(info *relaycommon.RelayInfo, status int, body string) *Rule {
	store := GlobalStore()
	if store == nil {
		return nil
	}
	platform := ""
	if info != nil {
		platform = itoaPlatform(info.ChannelType)
	}
	return store.Match(platform, status, body)
}

// applyRule mutates err according to the DB rule.
func applyRule(err *types.NewAPIError, r *Rule, upstreamStatus int) {
	if !r.PassthroughCode && r.ResponseCode != 0 {
		err.StatusCode = r.ResponseCode
	}
	if r.CustomMessage != "" {
		err.SetMessage(r.CustomMessage)
	} else {
		err.SetMessage(FixedMessage(upstreamStatus))
	}
}

// itoaPlatform converts int channel type to its string form.
func itoaPlatform(channelType int) string {
	if channelType == 0 {
		return ""
	}
	var buf [20]byte
	i := len(buf)
	for channelType > 0 {
		i--
		buf[i] = byte('0' + channelType%10)
		channelType /= 10
	}
	return string(buf[i:])
}

func shouldNormalize(info *relaycommon.RelayInfo) bool {
	if info == nil || info.ChannelMeta == nil {
		return false
	}
	global := operation_setting.GetUpstreamErrorNormalizeSetting()
	if global != nil && !global.Enabled {
		return false
	}
	if info != nil && info.ChannelSetting.NormalizeUpstreamErrors != nil {
		return *info.ChannelSetting.NormalizeUpstreamErrors
	}
	return true
}

// FixedMessage returns the fixed client-visible message for a given HTTP status.
func FixedMessage(status int) string {
	switch status {
	case http.StatusBadRequest:
		return "请求参数错误，请检查模型、消息格式或上下文长度。"
	case http.StatusUnauthorized:
		return "鉴权失败，请检查 API Key 或上游凭证。"
	case http.StatusPaymentRequired:
		return "余额或账单异常，请检查上游账户额度。"
	case http.StatusForbidden:
		return "权限不足，请检查模型权限、分组权限或地区限制。"
	case http.StatusNotFound:
		return "资源不存在，请检查模型名、接口路径或上游地址。"
	case http.StatusConflict:
		return "请求冲突，请稍后重试。"
	case http.StatusRequestEntityTooLarge:
		return "请求体过大，请压缩输入或拆分请求。"
	case http.StatusUnprocessableEntity:
		return "请求格式可解析但参数组合不被支持。"
	case http.StatusTooManyRequests:
		return "请求过于频繁或额度不足，请稍后重试。"
	case http.StatusGatewayTimeout, http.StatusRequestTimeout:
		return "请求超时，请稍后重试或改用流式输出。"
	}
	if status == 529 {
		return "上游模型过载，请稍后重试。"
	}
	if status >= 500 && status <= 599 {
		return "上游服务异常，请稍后重试。"
	}
	if status >= 400 && status <= 499 {
		return "请求无法被上游处理，请检查请求参数和模型权限。"
	}
	return "上游请求失败，请稍后重试。"
}

func channelIDForLog(info *relaycommon.RelayInfo) int {
	if info == nil || info.ChannelMeta == nil {
		return 0
	}
	return info.ChannelId
}
