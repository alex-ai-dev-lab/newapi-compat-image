package relay

import (
	"github.com/gin-gonic/gin"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/antipoison"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
)

// applyClaudeAntiPoisonRequest injects the guard prompt into the Claude system
// field when anti-poison is enabled.
//
// The guard prefix is stored on the RelayInfo for response-side validation.
// Defaults to a no-op when the channel has not enabled anti-poison.
func applyClaudeAntiPoisonRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) {
	if req == nil || info == nil {
		return
	}
	if !claudeRequestHasTools(req) {
		return
	}
	cfg := antipoison.ConfigForRelayInfo(info)
	if !cfg.Enabled {
		return
	}

	prefix := antipoison.RandomPrefix()
	info.AntiPoisonGuardPrefix = prefix

	prompt := antipoison.BuildGuardPrompt(prefix)
	injectClaudeGuardSystem(req, prompt)

	// Canary echo: inject nonce into the last user message
	antipoison.ApplyClaudeCanaryRequest(info, req)
}

func claudeRequestHasTools(req *dto.ClaudeRequest) bool {
	if req == nil {
		return false
	}
	if req.Tools != nil || req.ToolChoice != nil || len(req.McpServers) > 0 {
		return true
	}
	return false
}

func injectClaudeGuardSystem(req *dto.ClaudeRequest, guardPrompt string) {
	if req.System == nil {
		req.SetStringSystem(guardPrompt)
		return
	}
	if req.IsStringSystem() {
		existing := req.GetStringSystem()
		if existing == "" {
			req.SetStringSystem(guardPrompt)
		} else {
			req.SetStringSystem(guardPrompt + "\n" + existing)
		}
		return
	}
	systemContents := req.ParseSystem()
	newSystem := dto.ClaudeMediaMessage{Type: dto.ContentTypeText}
	newSystem.SetText(guardPrompt)
	if len(systemContents) == 0 {
		req.System = []dto.ClaudeMediaMessage{newSystem}
	} else {
		req.System = append([]dto.ClaudeMediaMessage{newSystem}, systemContents...)
	}
}

// applyClaudeAntiPoisonResponse validates guard coverage and strips markers from
// the non-stream Claude response. Returns an error when validation fails in block
// mode, which the relay handler converts to an HTTP error for the client.
func ApplyClaudeAntiPoisonResponse(c *gin.Context, info *relaycommon.RelayInfo, resp *dto.ClaudeResponse) error {
	if info == nil || resp == nil {
		return nil
	}
	cfg := antipoison.ConfigForRelayInfo(info)
	if !cfg.Enabled {
		return nil
	}

	// Shape check first
	if err := antipoison.ValidateClaudeResponseShape(resp, info.OriginModelName, cfg); err != nil {
		return err
	}

	// Tool-call guard validation
	if info.AntiPoisonGuardPrefix != "" {
		_, err := antipoison.ValidateAndStripClaudeResponse(resp, cfg, info.AntiPoisonGuardPrefix)
		if err != nil {
			return err
		}
	}

	// Canary echo validation
	if info.AntiPoisonCanaryNonce != "" {
		if err := antipoison.ValidateAndStripClaudeCanary(resp, cfg, info.AntiPoisonCanaryNonce); err != nil {
			return err
		}
	}
	if info.AntiPoisonAnswerEnvelopeNonce != "" {
		if err := antipoison.ValidateAndStripClaudeAnswerEnvelope(resp, info.AntiPoisonAnswerEnvelopeNonce, cfg); err != nil {
			return err
		}
	}
	if err := antipoison.ScanClaudeOpaquePayload(resp, cfg, ""); err != nil {
		return err
	}

	return nil
}

// applyClaudeAntiPoisonStreamChunk strips guard markers from a single stream chunk
// before forwarding to the client. Validation is deferred to the final event.
func ApplyClaudeAntiPoisonStreamChunk(c *gin.Context, info *relaycommon.RelayInfo, chunk *dto.ClaudeResponse) {
	if info == nil || chunk == nil || info.AntiPoisonGuardPrefix == "" {
		return
	}
	cfg := antipoison.ConfigForRelayInfo(info)
	if !cfg.Enabled {
		return
	}
	antipoison.StripClaudeStreamChunk(chunk)
}

// applyClaudeAntiPoisonStreamFinal performs final guard-coverage validation for
// stream responses. Called after the message_stop event when the full content has
// been accumulated. Returns a NewAPIError when validation fails in block mode.
func applyClaudeAntiPoisonStreamFinal(c *gin.Context, info *relaycommon.RelayInfo, accumulated *dto.ClaudeResponse) *types.NewAPIError {
	if info == nil || accumulated == nil {
		return nil
	}
	cfg := antipoison.ConfigForRelayInfo(info)
	if !cfg.Enabled {
		return nil
	}

	// Shape check first
	if err := antipoison.ValidateClaudeResponseShape(accumulated, info.OriginModelName, cfg); err != nil {
		return types.NewError(err, types.ErrorCodeAntiPoisonValidationFailed)
	}

	// Tool-call guard validation
	if info.AntiPoisonGuardPrefix != "" {
		_, err := antipoison.ValidateAndStripClaudeResponse(accumulated, cfg, info.AntiPoisonGuardPrefix)
		if err != nil {
			return types.NewError(err, types.ErrorCodeAntiPoisonValidationFailed)
		}
	}

	// Canary echo validation (stream version uses the accumulated content)
	if info.AntiPoisonCanaryNonce != "" {
		if err := antipoison.ValidateAndStripClaudeCanary(accumulated, cfg, info.AntiPoisonCanaryNonce); err != nil {
			return types.NewError(err, types.ErrorCodeAntiPoisonValidationFailed)
		}
	}

	return nil
}
