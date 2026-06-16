package antipoison

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func toolCallGuardEnabled() bool {
	setting := operation_setting.GetAntiPoisonSetting()
	return setting.Enabled && setting.ToolCallGuardEnabled
}

func ShouldGuardOpenAIRequest(req *dto.GeneralOpenAIRequest) bool {
	if req == nil || !toolCallGuardEnabled() {
		return false
	}
	if len(req.Tools) > 0 {
		return true
	}
	return len(req.Functions) > 0 || len(req.FunctionCall) > 0 || req.ToolChoice != nil
}

func ShouldGuardResponsesRequest(req *dto.OpenAIResponsesRequest) bool {
	if req == nil || !toolCallGuardEnabled() {
		return false
	}
	return len(req.Tools) > 0 || len(req.ToolChoice) > 0
}

func ApplyOpenAIRequestGuard(info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) {
	if info == nil || req == nil || !ShouldGuardOpenAIRequest(req) {
		return
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	if !cfg.Enabled {
		return
	}
	prefix := RandomPrefix()
	info.AntiPoisonGuardPrefix = prefix
	injectOpenAISystemPrompt(req, BuildGuardPrompt(prefix))
}

func ApplyOpenAIAnswerEnvelope(info *relaycommon.RelayInfo, req *dto.GeneralOpenAIRequest) {
	if info == nil || req == nil {
		return
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	if !EnvelopeRequired(cfg, info.IsStream) {
		return
	}
	nonce := RandomPrefix()
	info.AntiPoisonAnswerEnvelopeNonce = nonce
	injectOpenAISystemPrompt(req, BuildAnswerEnvelopePrompt(nonce))
}

func ApplyResponsesRequestGuard(info *relaycommon.RelayInfo, req *dto.OpenAIResponsesRequest) {
	if info == nil || req == nil || !ShouldGuardResponsesRequest(req) {
		return
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	if !cfg.Enabled {
		return
	}
	prefix := RandomPrefix()
	info.AntiPoisonGuardPrefix = prefix
	guardPrompt := BuildGuardPrompt(prefix)
	if len(req.Instructions) == 0 || common.GetJsonType(req.Instructions) == "null" {
		if b, err := common.Marshal(guardPrompt); err == nil {
			req.Instructions = b
		}
		return
	}
	var existing string
	if err := common.Unmarshal(req.Instructions, &existing); err == nil {
		if b, marshalErr := common.Marshal(guardPrompt + "\n" + existing); marshalErr == nil {
			req.Instructions = b
		}
	}
}

func ApplyResponsesAnswerEnvelope(info *relaycommon.RelayInfo, req *dto.OpenAIResponsesRequest) {
	if info == nil || req == nil {
		return
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	if !EnvelopeRequired(cfg, info.IsStream) {
		return
	}
	nonce := RandomPrefix()
	info.AntiPoisonAnswerEnvelopeNonce = nonce
	prompt := BuildAnswerEnvelopePrompt(nonce)
	if len(req.Instructions) == 0 || common.GetJsonType(req.Instructions) == "null" {
		if b, err := common.Marshal(prompt); err == nil {
			req.Instructions = b
		}
		return
	}
	var existing string
	if err := common.Unmarshal(req.Instructions, &existing); err == nil {
		if b, marshalErr := common.Marshal(prompt + "\n" + existing); marshalErr == nil {
			req.Instructions = b
		}
	}
}

func ValidateAndStripOpenAIResponse(resp *dto.OpenAITextResponse, cfg Config, guardPrefix string) error {
	if !cfg.Enabled || guardPrefix == "" || resp == nil {
		return nil
	}
	var rawMarkers []string
	var expectedTools []string
	for i := range resp.Choices {
		msg := &resp.Choices[i].Message
		if msg.IsStringContent() {
			cleaned, markers := StripGuardMarkersWithConfig(msg.StringContent(), cfg)
			msg.SetStringContent(cleaned)
			rawMarkers = append(rawMarkers, markers...)
		}
		expectedTools = append(expectedTools, toolNamesFromRawToolCalls(msg.ToolCalls)...)
	}
	ok, reason := ValidateGuardMarkers(rawMarkers, guardPrefix, expectedTools, cfg.StrictMode)
	if ok {
		return nil
	}
	return guardFailure(reason, len(expectedTools), len(rawMarkers), cfg)
}

func ValidateAndStripOpenAIStreamChunk(data string, cfg Config, guardPrefix string) (cleanData string, markers []string, toolNames []string, err error) {
	if !cfg.Enabled || guardPrefix == "" || data == "" {
		return data, nil, nil, nil
	}
	var chunk dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
		return data, nil, nil, err
	}
	changed := false
	for i := range chunk.Choices {
		delta := &chunk.Choices[i].Delta
		if delta.Content != nil {
			cleaned, found := StripGuardMarkersWithConfig(delta.GetContentString(), cfg)
			if len(found) > 0 {
				delta.SetContentString(cleaned)
				markers = append(markers, found...)
				changed = true
			}
		}
		for _, tc := range delta.ToolCalls {
			if strings.TrimSpace(tc.Function.Name) != "" {
				toolNames = append(toolNames, tc.Function.Name)
			}
		}
	}
	if !changed {
		return data, markers, toolNames, nil
	}
	b, marshalErr := common.Marshal(chunk)
	if marshalErr != nil {
		return data, markers, toolNames, marshalErr
	}
	return string(b), markers, toolNames, nil
}

func ValidateOpenAIStreamFinal(rawMarkers []string, toolNames []string, cfg Config, guardPrefix string) error {
	if !cfg.Enabled || guardPrefix == "" {
		return nil
	}
	ok, reason := ValidateGuardMarkers(rawMarkers, guardPrefix, compactNonEmpty(toolNames), cfg.StrictMode)
	if ok {
		return nil
	}
	return guardFailure(reason, len(toolNames), len(rawMarkers), cfg)
}

func ValidateAndStripResponsesResponse(resp *dto.OpenAIResponsesResponse, cfg Config, guardPrefix string) error {
	if !cfg.Enabled || guardPrefix == "" || resp == nil {
		return nil
	}
	var rawMarkers []string
	var expectedTools []string
	for i := range resp.Output {
		out := &resp.Output[i]
		if out.Type == "function_call" {
			expectedTools = append(expectedTools, strings.TrimSpace(out.Name))
		}
		for j := range out.Content {
			cleaned, found := StripGuardMarkersWithConfig(out.Content[j].Text, cfg)
			if len(found) > 0 {
				out.Content[j].Text = cleaned
				rawMarkers = append(rawMarkers, found...)
			}
		}
	}
	ok, reason := ValidateGuardMarkers(rawMarkers, guardPrefix, compactNonEmpty(expectedTools), cfg.StrictMode)
	if ok {
		return nil
	}
	return guardFailure(reason, len(expectedTools), len(rawMarkers), cfg)
}

func StripResponsesTextDelta(delta string, cfg Config) (string, []string) {
	return StripGuardMarkersWithConfig(delta, cfg)
}

func toolNamesFromRawToolCalls(raw json.RawMessage) []string {
	if len(raw) == 0 || common.GetJsonType(raw) == "null" {
		return nil
	}
	var calls []dto.ToolCallResponse
	if err := common.Unmarshal(raw, &calls); err != nil {
		return nil
	}
	names := make([]string, 0, len(calls))
	for _, call := range calls {
		name := strings.TrimSpace(call.Function.Name)
		if name != "" {
			names = append(names, name)
		}
	}
	return names
}

func compactNonEmpty(items []string) []string {
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item != "" {
			out = append(out, item)
		}
	}
	return out
}

func guardFailure(reason string, toolCount, guardCount int, cfg Config) error {
	err := fmt.Errorf("anti-poison validation failed: %s (tools=%d guards=%d)", reason, toolCount, guardCount)
	if cfg.FailureMode == FailureModeWarn {
		common.SysLog("anti-poison warn: " + err.Error())
		return nil
	}
	if reason == "" {
		return errors.New("anti-poison validation failed")
	}
	return err
}

func FixedClientError() error {
	return errors.New("anti-poison validation failed")
}

func IsGuardFailure(err error) bool {
	return err != nil && strings.Contains(err.Error(), "anti-poison validation failed")
}

func ShouldHideGuardHeaderDownstream() bool {
	return !operation_setting.GetAntiPoisonSetting().DownstreamProofHeader
}

func ChannelTestNonceEnabled() bool {
	setting := operation_setting.GetAntiPoisonSetting()
	return setting.Enabled && setting.ChannelTestNonceEnabled
}

func ResponseGuardConfig(info *relaycommon.RelayInfo) Config {
	if info == nil {
		return GlobalConfig()
	}
	return FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
}

func IsToolCallFinishReason(reason string) bool {
	return reason == constant.FinishReasonToolCalls || reason == "function_call"
}
