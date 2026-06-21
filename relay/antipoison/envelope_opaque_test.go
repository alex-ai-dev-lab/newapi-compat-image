package antipoison

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func requiredEnvelopeConfig() Config {
	return Config{
		Enabled:        true,
		Profile:        operation_setting.AntiPoisonProfileProbation,
		AnswerEnvelope: operation_setting.AntiPoisonModeRequired,
		OpaqueScan:     operation_setting.AntiPoisonModeScoreStrict,
	}
}

func TestValidateAndExtractAnswerEnvelopeXML(t *testing.T) {
	cleaned, err := ValidateAndExtractAnswerEnvelope(`<newapi_answer nonce="n1">OK</newapi_answer>`, "n1", requiredEnvelopeConfig())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cleaned != "OK" {
		t.Fatalf("cleaned=%q", cleaned)
	}
}

func TestValidateAndExtractAnswerEnvelopeJSON(t *testing.T) {
	cleaned, err := ValidateAndExtractAnswerEnvelope(`{"newapi_nonce":"n1","answer":"OK"}`, "n1", requiredEnvelopeConfig())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cleaned != "OK" {
		t.Fatalf("cleaned=%q", cleaned)
	}
}

func TestValidateAnswerEnvelopeRejectsOutsideText(t *testing.T) {
	_, err := ValidateAndExtractAnswerEnvelope(`ad <newapi_answer nonce="n1">OK</newapi_answer>`, "n1", requiredEnvelopeConfig())
	if !errors.Is(err, ErrEnvelopeOutsideText) {
		t.Fatalf("err=%v, want outside text", err)
	}
}

func TestValidateAnswerEnvelopeRejectsNonceMismatch(t *testing.T) {
	_, err := ValidateAndExtractAnswerEnvelope(`<newapi_answer nonce="bad">OK</newapi_answer>`, "n1", requiredEnvelopeConfig())
	if !errors.Is(err, ErrEnvelopeNonceMismatch) {
		t.Fatalf("err=%v, want nonce mismatch", err)
	}
}

func TestValidateAndStripOpenAIAnswerEnvelope(t *testing.T) {
	resp := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{{
			Message: dto.Message{Role: "assistant", Content: `<newapi_answer nonce="n1">OK</newapi_answer>`},
		}},
	}
	if err := ValidateAndStripOpenAIAnswerEnvelope(resp, "n1", requiredEnvelopeConfig()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := resp.Choices[0].Message.StringContent(); got != "OK" {
		t.Fatalf("content=%q", got)
	}
}

func TestProbationExactOKAfterEnvelopeStrip(t *testing.T) {
	resp := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{{
			Message: dto.Message{Role: "assistant", Content: `<newapi_answer nonce="n1">OK</newapi_answer>`},
		}},
	}
	cfg := FromChannelSettingsForChannel(101, dto.ChannelSettings{
		AntiPoisonEnabled: boolPtr(true),
	})
	if cfg.CanaryEcho {
		t.Fatalf("101 must not use real-user canary for exact-output requests")
	}
	if err := ValidateAndStripOpenAIAnswerEnvelope(resp, "n1", cfg); err != nil {
		t.Fatalf("unexpected envelope error: %v", err)
	}
	if got := resp.Choices[0].Message.StringContent(); got != "OK" {
		t.Fatalf("content=%q, want OK", got)
	}
}

func TestProbationBlocksHTTP200AdWithoutEnvelopeAsSuspicious(t *testing.T) {
	resp := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{{
			Message: dto.Message{Role: "assistant", Content: "OpenAI Chat 接口未开启，请加群充值联系客服"},
		}},
	}
	cfg := FromChannelSettingsForChannel(101, dto.ChannelSettings{
		AntiPoisonEnabled: boolPtr(true),
	})
	err := ValidateAndStripOpenAIAnswerEnvelope(resp, "n1", cfg)
	if !errors.Is(err, ErrEnvelopeMissing) {
		t.Fatalf("err=%v, want envelope missing", err)
	}
}

func TestValidateAnswerEnvelopeRejectsOutsideEncodedPayload(t *testing.T) {
	_, err := ValidateAndExtractAnswerEnvelope(`<newapi_answer nonce="n1">OK</newapi_answer>
U2FsdGVkX1+xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, "n1", requiredEnvelopeConfig())
	if !errors.Is(err, ErrEnvelopeOutsideText) {
		t.Fatalf("err=%v, want outside text", err)
	}
}

func TestOpaqueScannerBlocksZeroWidthProbation(t *testing.T) {
	result := ScanOpaquePayload("hello\u200bworld", requiredEnvelopeConfig(), "")
	if result.Action != OpaqueActionBlock {
		t.Fatalf("action=%s score=%d signals=%v", result.Action, result.Score, result.Signals)
	}
}

func TestOpaqueScannerDowngradesEncodingUserIntent(t *testing.T) {
	blob := strings.Repeat("QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", 4)
	result := ScanOpaquePayload("sample:\n```text\n"+blob+"\n```", requiredEnvelopeConfig(), "show a base64 example")
	if result.Action == OpaqueActionBlock {
		t.Fatalf("unexpected block score=%d signals=%v", result.Score, result.Signals)
	}
}

func TestOpaqueScannerSuspiciousLongBase64RetriesProbation(t *testing.T) {
	blob := strings.Repeat("QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", 4)
	result := ScanOpaquePayload(blob, requiredEnvelopeConfig(), "")
	if result.Action != OpaqueActionRetry {
		t.Fatalf("action=%s score=%d signals=%v, want retry", result.Action, result.Score, result.Signals)
	}
	if !errors.Is(OpaqueScanError(result), ErrOpaquePayloadSuspicious) {
		t.Fatalf("opaque retry should surface suspicious error")
	}
}

func TestOpaqueScannerDetectsURLSafeBase64(t *testing.T) {
	payload := strings.Repeat("https://internal.example/<script>alert(1)</script>", 3)
	blob := base64.RawURLEncoding.EncodeToString([]byte(payload))
	result := ScanOpaquePayload(blob, requiredEnvelopeConfig(), "")
	if result.Action != OpaqueActionBlock {
		t.Fatalf("action=%s score=%d signals=%v, want block", result.Action, result.Score, result.Signals)
	}
}

func TestProfilesDefaultChannels(t *testing.T) {
	if got := FromChannelSettingsForChannel(77, dto.ChannelSettings{}); got.Profile != operation_setting.AntiPoisonProfileTrusted || EnvelopeRequired(got, false) {
		t.Fatalf("77 profile=%s envelope=%v", got.Profile, EnvelopeRequired(got, false))
	}
	enabled := true
	if got := FromChannelSettingsForChannel(101, dto.ChannelSettings{
		AntiPoisonEnabled: &enabled,
	}); got.Profile != operation_setting.AntiPoisonProfileProbation || !EnvelopeRequired(got, false) {
		t.Fatalf("101 profile=%s envelope=%v", got.Profile, EnvelopeRequired(got, false))
	}
	if ProductionRoutingAllowed(94, dto.ChannelSettings{
		AntiPoisonEnabled: &enabled,
	}) {
		t.Fatalf("94 should not be production routable")
	}
	if got := FromChannelSettingsForChannel(94, dto.ChannelSettings{
		AntiPoisonEnabled: &enabled,
	}); got.Profile != operation_setting.AntiPoisonProfileQuarantine || got.ProductionRouting || !got.ScheduledProbeOnly {
		t.Fatalf("94 profile=%s production=%v scheduledProbe=%v", got.Profile, got.ProductionRouting, got.ScheduledProbeOnly)
	}
	if got := FromChannelSettingsForChannel(101, dto.ChannelSettings{
		AntiPoisonEnabled: &enabled,
	}); !got.ProbeBeforeEveryRequest || got.StreamMode != operation_setting.AntiPoisonStreamAggregateThenReplay {
		t.Fatalf("101 probe=%v stream=%s", got.ProbeBeforeEveryRequest, got.StreamMode)
	}
}

func TestDefaultRealUserCanaryDisabled(t *testing.T) {
	cfg := FromChannelSettingsForChannel(101, dto.ChannelSettings{})
	if cfg.CanaryEcho {
		t.Fatalf("real user canary should default to disabled")
	}
	if !cfg.CanaryForProbeOnly {
		t.Fatalf("probe-only canary should remain enabled")
	}
	if cfg.DisableOnSingleCanaryMissing {
		t.Fatalf("single canary miss must not permanently disable by default")
	}
}
