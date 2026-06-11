package controller

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const antiPoisonEvidencePreviewLimit = 128 * 1024

type antiPoisonEvidencePayload struct {
	RequestID       string              `json:"request_id"`
	CreatedAt       string              `json:"created_at"`
	ChannelID       int                 `json:"channel_id"`
	ChannelName     string              `json:"channel_name"`
	ChannelType     int                 `json:"channel_type"`
	Model           string              `json:"model"`
	UserID          int                 `json:"user_id"`
	TokenID         int                 `json:"token_id"`
	TokenName       string              `json:"token_name"`
	Group           string              `json:"group"`
	Method          string              `json:"method"`
	Path            string              `json:"path"`
	IsStream        bool                `json:"is_stream"`
	UsedChannels    []string            `json:"used_channels"`
	RequestHeaders  map[string][]string `json:"request_headers"`
	RequestBody     previewBody         `json:"request_body"`
	UpstreamBody    previewBody         `json:"upstream_body"`
	ErrorType       string              `json:"error_type"`
	ErrorCode       any                 `json:"error_code"`
	StatusCode      int                 `json:"status_code"`
	SanitizedError  string              `json:"sanitized_error"`
	OriginalErrText string              `json:"original_error_text"`
}

type previewBody struct {
	Text             string `json:"text"`
	OriginalBytes    int    `json:"original_bytes"`
	Truncated        bool   `json:"truncated"`
	UnavailableError string `json:"unavailable_error,omitempty"`
}

func persistAntiPoisonEvidence(c *gin.Context, channelError types.ChannelError, err *types.NewAPIError) string {
	if c == nil || err == nil {
		return ""
	}
	payload := antiPoisonEvidencePayload{
		RequestID:       resolveEvidenceRequestID(c),
		CreatedAt:       time.Now().Format(time.RFC3339Nano),
		ChannelID:       channelError.ChannelId,
		ChannelName:     firstNonEmpty(channelError.ChannelName, c.GetString("channel_name")),
		ChannelType:     c.GetInt("channel_type"),
		Model:           c.GetString("original_model"),
		UserID:          c.GetInt("id"),
		TokenID:         c.GetInt("token_id"),
		TokenName:       c.GetString("token_name"),
		Group:           c.GetString("group"),
		IsStream:        common.GetContextKeyBool(c, constant.ContextKeyIsStream),
		UsedChannels:    c.GetStringSlice("use_channel"),
		RequestHeaders:  sanitizeEvidenceHeaders(c.Request.Header),
		RequestBody:     getEvidenceRequestBodyPreview(c),
		UpstreamBody:    previewString(common.GetContextKeyString(c, constant.ContextKeyAntiPoisonEvidenceResponse)),
		ErrorType:       string(err.GetErrorType()),
		ErrorCode:       err.GetErrorCode(),
		StatusCode:      err.StatusCode,
		SanitizedError:  err.MaskSensitiveErrorWithStatusCode(),
		OriginalErrText: common.LocalLogPreview(err.ErrorWithStatusCode()),
	}
	if c.Request != nil {
		payload.Method = c.Request.Method
		if c.Request.URL != nil {
			payload.Path = c.Request.URL.Path
		}
	}

	data, marshalErr := json.MarshalIndent(payload, "", "  ")
	if marshalErr != nil {
		common.SysError("failed to marshal anti-poison evidence: " + marshalErr.Error())
		return ""
	}
	dir := filepath.Join(resolveEvidenceBaseDir(), "anti-poison", fmt.Sprintf("channel-%d", channelError.ChannelId))
	if mkdirErr := os.MkdirAll(dir, 0750); mkdirErr != nil {
		common.SysError("failed to create anti-poison evidence directory: " + mkdirErr.Error())
		return ""
	}
	path := filepath.Join(dir, sanitizeEvidenceFilename(payload.RequestID)+".json")
	if writeErr := os.WriteFile(path, data, 0600); writeErr != nil {
		common.SysError("failed to write anti-poison evidence: " + writeErr.Error())
		return ""
	}
	if updateErr := model.SetChannelAntiPoisonEvidencePath(channelError.ChannelId, path); updateErr != nil {
		common.SysError("failed to save anti-poison evidence path to channel: " + updateErr.Error())
	}
	return path
}

func resolveEvidenceBaseDir() string {
	if common.LogDir != nil && *common.LogDir != "" {
		return *common.LogDir
	}
	return "./logs"
}

func resolveEvidenceRequestID(c *gin.Context) string {
	for _, key := range []string{"id", "request_id"} {
		if value := strings.TrimSpace(c.GetString(key)); value != "" {
			return value
		}
	}
	if c.Request != nil {
		for _, header := range []string{"X-Request-Id", "X-Newapi-Request-Id", "X-Oneapi-Request-Id"} {
			if value := strings.TrimSpace(c.Request.Header.Get(header)); value != "" {
				return value
			}
		}
	}
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func sanitizeEvidenceFilename(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	var b strings.Builder
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.' {
			b.WriteRune(r)
		} else {
			b.WriteByte('_')
		}
	}
	return b.String()
}

func sanitizeEvidenceHeaders(headers http.Header) map[string][]string {
	out := make(map[string][]string, len(headers))
	for key, values := range headers {
		lower := strings.ToLower(key)
		if lower == "authorization" || lower == "proxy-authorization" || lower == "cookie" || lower == "set-cookie" || lower == "x-api-key" || strings.Contains(lower, "token") || strings.Contains(lower, "secret") || strings.Contains(lower, "key") {
			out[key] = []string{"***masked***"}
			continue
		}
		copied := make([]string, len(values))
		copy(copied, values)
		out[key] = copied
	}
	return out
}

func getEvidenceRequestBodyPreview(c *gin.Context) previewBody {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return previewBody{UnavailableError: err.Error()}
	}
	if _, err := storage.Seek(0, io.SeekStart); err != nil {
		return previewBody{UnavailableError: err.Error()}
	}
	limited := io.LimitReader(storage, antiPoisonEvidencePreviewLimit+1)
	data, err := io.ReadAll(limited)
	if err != nil {
		return previewBody{UnavailableError: err.Error()}
	}
	_, _ = storage.Seek(0, io.SeekStart)
	return previewBytes(data, int(storage.Size()))
}

func previewString(text string) previewBody {
	return previewBytes([]byte(text), len(text))
}

func previewBytes(data []byte, originalBytes int) previewBody {
	truncated := false
	if len(data) > antiPoisonEvidencePreviewLimit {
		data = data[:antiPoisonEvidencePreviewLimit]
		truncated = true
	}
	if originalBytes > len(data) {
		truncated = true
	}
	return previewBody{
		Text:          string(data),
		OriginalBytes: originalBytes,
		Truncated:     truncated,
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
