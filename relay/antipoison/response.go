package antipoison

import (
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// ApplyClaudeResponseValidation validates guard coverage and strips markers from
// a Claude response. Returns an error when validation fails in block mode.
// Safe to call with nil/empty inputs; returns nil when anti-poison is disabled.
func ApplyClaudeResponseValidation(info *relaycommon.RelayInfo, resp *dto.ClaudeResponse) error {
	if info == nil || resp == nil || info.AntiPoisonGuardPrefix == "" {
		return nil
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	if !cfg.Enabled {
		return nil
	}
	_, err := ValidateAndStripClaudeResponse(resp, cfg, info.AntiPoisonGuardPrefix)
	return err
}

// ApplyClaudeStreamChunkStripping strips guard markers from a single stream chunk.
// Guard counting for stream responses is deferred to the final validation.
func ApplyClaudeStreamChunkStripping(info *relaycommon.RelayInfo, chunk *dto.ClaudeResponse) {
	if info == nil || chunk == nil || info.AntiPoisonGuardPrefix == "" {
		return
	}
	cfg := FromChannelSettingsForChannel(info.ChannelId, info.ChannelSetting)
	if !cfg.Enabled {
		return
	}
	StripClaudeStreamChunk(chunk)
}
