package antipoison

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestBuildCanaryMarker(t *testing.T) {
	nonce := "0123456789abcdef"
	marker := buildCanaryMarker(nonce)
	if !strings.Contains(marker, nonce) {
		t.Fatalf("marker missing nonce: %q", marker)
	}
	if !strings.HasPrefix(marker, canaryMarkerPrefix) || !strings.HasSuffix(marker, canaryMarkerSuffix) {
		t.Fatalf("marker format wrong: %q", marker)
	}
}

func TestValidateAndStripCanary(t *testing.T) {
	nonce := "0123456789abcdef"
	marker := buildCanaryMarker(nonce)
	text := "This is the answer. " + marker
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}

	cleaned, err := ValidateAndStripCanary(text, nonce, cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(cleaned, marker) {
		t.Fatalf("marker not stripped: %q", cleaned)
	}
	if !strings.Contains(cleaned, "This is the answer.") {
		t.Fatalf("answer lost: %q", cleaned)
	}
}

func TestValidateAndStripCanaryRejectsShortNonceMarker(t *testing.T) {
	text := "answer " + buildCanaryMarker("deadbeef")
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}

	_, err := ValidateAndStripCanary(text, "0123456789abcdef", cfg)
	if err == nil {
		t.Fatalf("expected short nonce marker to be rejected")
	}
}

func TestValidateAndStripCanaryWrongNonce(t *testing.T) {
	marker := buildCanaryMarker("fedcba9876543210")
	text := "answer " + marker
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}

	_, err := ValidateAndStripCanary(text, "0123456789abcdef", cfg)
	if err == nil {
		t.Fatalf("expected nonce mismatch error")
	}
}

func TestValidateAndStripCanaryMissing(t *testing.T) {
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}
	_, err := ValidateAndStripCanary("answer without marker", "0123456789abcdef", cfg)
	if err == nil {
		t.Fatalf("expected missing marker error")
	}
}

func TestApplyClaudeCanaryRequest(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "claude-opus-4",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "hello"},
		},
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelSetting: dto.ChannelSettings{
				AntiPoisonEnabled:           boolPtr(true),
				AntiPoisonCanaryEchoEnabled: boolPtr(true),
			},
		},
	}
	ApplyClaudeCanaryRequest(info, req)

	if info.AntiPoisonCanaryNonce == "" {
		t.Fatalf("nonce not set")
	}
	lastMsg := req.Messages[len(req.Messages)-1]
	if !strings.Contains(lastMsg.GetStringContent(), buildCanaryMarker(info.AntiPoisonCanaryNonce)) {
		t.Fatalf("canary not injected: %q", lastMsg.GetStringContent())
	}
}

func TestValidateAndStripClaudeCanary(t *testing.T) {
	nonce := "0123456789abcdef"
	marker := buildCanaryMarker(nonce)
	text := "answer " + marker
	resp := &dto.ClaudeResponse{
		Id:    "msg_test",
		Model: "claude-opus-4",
		Content: []dto.ClaudeMediaMessage{
			{Type: "text", Text: &text},
		},
	}
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}

	err := ValidateAndStripClaudeCanary(resp, cfg, nonce)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(resp.Content[0].GetText(), marker) {
		t.Fatalf("marker not stripped: %q", resp.Content[0].GetText())
	}
}

func TestCanaryStreamValidator(t *testing.T) {
	nonce := "0123456789abcdef"
	marker := buildCanaryMarker(nonce)
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}
	v := NewCanaryStreamValidator(nonce, cfg, 128)

	// Send chunks
	emit1, hold1, err1 := v.ProcessText("This is ")
	if err1 != nil || hold1 != true || emit1 != "" {
		t.Fatalf("chunk1 emit=%q hold=%v err=%v", emit1, hold1, err1)
	}

	emit2, hold2, err2 := v.ProcessText("the answer. " + marker)
	if err2 != nil {
		t.Fatalf("chunk2 err=%v", err2)
	}
	if hold2 {
		t.Fatalf("chunk2 should release after finding marker")
	}
	if !strings.Contains(emit2, "This is the answer.") {
		t.Fatalf("emit2=%q", emit2)
	}
	if strings.Contains(emit2, marker) {
		t.Fatalf("marker leaked: %q", emit2)
	}
	if !v.Verified() {
		t.Fatalf("not verified")
	}
}

func TestCanaryStreamValidatorMissing(t *testing.T) {
	nonce := "0123456789abcdef"
	cfg := Config{Enabled: true, CanaryEcho: true, MaxScanBytes: 1024}
	v := NewCanaryStreamValidator(nonce, cfg, 128)

	_, _, _ = v.ProcessText("answer without marker")
	err := v.Finalize()
	if err == nil {
		t.Fatalf("expected missing marker error")
	}
}

func boolPtr(b bool) *bool {
	return &b
}
