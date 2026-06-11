package antipoison

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func ApplyClaudeAnswerEnvelope(info *relaycommon.RelayInfo, req *dto.ClaudeRequest) {
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
	if req.System == nil {
		req.SetStringSystem(prompt)
		return
	}
	if req.IsStringSystem() {
		existing := strings.TrimSpace(req.GetStringSystem())
		if existing == "" {
			req.SetStringSystem(prompt)
		} else {
			req.SetStringSystem(prompt + "\n" + existing)
		}
		return
	}
	systemContents := req.ParseSystem()
	newSystem := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	newSystem.SetText(prompt)
	req.System = append([]dto.ClaudeMediaMessage{newSystem}, systemContents...)
}

// ValidateAndStripClaudeResponse validates guard coverage for a Claude response
// and strips guard markers from text content before returning to the client.
//
// Returns the cleaned response and an error if validation failed in block mode.
func ValidateAndStripClaudeResponse(resp *dto.ClaudeResponse, cfg Config, guardPrefix string) (*dto.ClaudeResponse, error) {
	if !cfg.Enabled || guardPrefix == "" || resp == nil {
		return resp, nil
	}

	// Count real tool_use blocks in response content.
	toolUseCount := 0
	for _, block := range resp.Content {
		if block.Type == "tool_use" {
			toolUseCount++
		}
	}

	// Strip guard markers from all text blocks and count how many we found.
	totalGuardCount := 0
	for i := range resp.Content {
		if resp.Content[i].Type == "text" {
			text := resp.Content[i].GetText()
			if text == "" {
				continue
			}
			cleaned, rawMarkers := StripGuardMarkersWithConfig(text, cfg)
			resp.Content[i].SetText(cleaned)
			totalGuardCount += len(rawMarkers)
		}
	}

	// Validate coverage: do we have enough guards for the tool calls?
	ok, reason := ValidateCoverage(toolUseCount, totalGuardCount, cfg.StrictMode)
	if !ok {
		msg := fmt.Sprintf("anti-poison validation failed: %s (tools=%d guards=%d)",
			reason, toolUseCount, totalGuardCount)
		if cfg.FailureMode == FailureModeBlock {
			return nil, fmt.Errorf("%s", msg)
		}
		// Warn mode: log but allow response through.
		common.SysLog("anti-poison warn: " + msg)
	}

	return resp, nil
}

// StripClaudeStreamChunk strips guard markers from a single SSE chunk's text delta.
// Guard counting for stream responses is deferred to the final message_stop event
// where Content is accumulated, so this only performs cosmetic stripping.
func StripClaudeStreamChunk(chunk *dto.ClaudeResponse) {
	if chunk == nil {
		return
	}
	if chunk.Delta != nil && chunk.Delta.Type == "text_delta" {
		text := chunk.Delta.GetText()
		if text != "" && CountGuardMarkers(text) > 0 {
			cleaned, _ := StripGuardMarkersWithConfig(text, Config{Enabled: true, StripOutput: true})
			chunk.Delta.SetText(cleaned)
		}
	}
	if chunk.ContentBlock != nil && chunk.ContentBlock.Type == "text" {
		text := chunk.ContentBlock.GetText()
		if text != "" && CountGuardMarkers(text) > 0 {
			cleaned, _ := StripGuardMarkersWithConfig(text, Config{Enabled: true, StripOutput: true})
			chunk.ContentBlock.SetText(cleaned)
		}
	}
}
