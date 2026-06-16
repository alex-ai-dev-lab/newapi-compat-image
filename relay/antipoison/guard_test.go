package antipoison

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestGuardPrefixStableAndShort(t *testing.T) {
	a := GuardPrefix("req-1|ch-50")
	b := GuardPrefix("req-1|ch-50")
	c := GuardPrefix("req-2|ch-50")
	if a != b {
		t.Fatalf("prefix not stable for same seed: %q != %q", a, b)
	}
	if a == c {
		t.Fatalf("prefix collided for different seeds")
	}
	if len(a) != 8 {
		t.Fatalf("prefix length = %d, want 8", len(a))
	}
}

func TestRandomPrefixMatchesDeclaredHexLength(t *testing.T) {
	prefix := RandomPrefix()
	if len(prefix) != randomPrefixHexLength {
		t.Fatalf("random prefix length = %d, want %d", len(prefix), randomPrefixHexLength)
	}
	for _, ch := range prefix {
		if !strings.ContainsRune("0123456789abcdef", ch) {
			t.Fatalf("random prefix contains non-lowercase-hex rune %q in %q", ch, prefix)
		}
	}
}

func TestBuildGuardPromptContainsTags(t *testing.T) {
	p := BuildGuardPrompt("abcd1234")
	if !strings.Contains(p, guardOpenTag) || !strings.Contains(p, guardCloseTag) {
		t.Fatalf("guard prompt missing tags: %q", p)
	}
	if !strings.Contains(p, "aad_guard_abcd1234_") {
		t.Fatalf("guard prompt missing prefixed name: %q", p)
	}
}

func TestStripGuardMarkers(t *testing.T) {
	prefix := "abcd1234"
	text := "before " + guardOpenTag + `{"name":"aad_guard_` + prefix + `_Read","tool_name":"Read"}` + guardCloseTag + " after"
	cleaned, raw := StripGuardMarkers(text)
	if strings.Contains(cleaned, guardOpenTag) {
		t.Fatalf("cleaned still has tags: %q", cleaned)
	}
	if len(raw) != 1 {
		t.Fatalf("expected 1 raw marker, got %d", len(raw))
	}
	if !strings.Contains(raw[0], "aad_guard_"+prefix+"_Read") {
		t.Fatalf("raw marker wrong: %q", raw[0])
	}
}

func TestStripGuardMarkersNoMarkers(t *testing.T) {
	text := "plain text with no markers"
	cleaned, raw := StripGuardMarkers(text)
	if cleaned != text {
		t.Fatalf("cleaned changed unexpectedly: %q", cleaned)
	}
	if raw != nil {
		t.Fatalf("expected nil raw, got %v", raw)
	}
}

func TestCountGuardMarkers(t *testing.T) {
	prefix := "p"
	one := guardOpenTag + `{"tool_name":"A"}` + guardCloseTag
	text := one + " x " + one + " y " + one
	if got := CountGuardMarkers(text); got != 3 {
		t.Fatalf("count = %d, want 3", got)
	}
	_ = prefix
	if got := CountGuardMarkers("no markers"); got != 0 {
		t.Fatalf("count = %d, want 0", got)
	}
}

func TestValidateCoverageNoToolCalls(t *testing.T) {
	ok, reason := ValidateCoverage(0, 0, true)
	if !ok || reason != "" {
		t.Fatalf("no tool calls should pass, got ok=%v reason=%q", ok, reason)
	}
}

func TestValidateCoverageStrict(t *testing.T) {
	// 2 tool calls, 2 guards -> ok
	if ok, _ := ValidateCoverage(2, 2, true); !ok {
		t.Fatalf("2/2 strict should pass")
	}
	// 3 tool calls, 2 guards -> mismatch
	ok, reason := ValidateCoverage(3, 2, true)
	if ok || reason != "guard_coverage_mismatch" {
		t.Fatalf("3/2 strict should fail mismatch, got ok=%v reason=%q", ok, reason)
	}
}

func TestValidateCoverageNonStrict(t *testing.T) {
	// tool calls present, zero guards -> missing
	ok, reason := ValidateCoverage(2, 0, false)
	if ok || reason != "missing_guard_toolcall" {
		t.Fatalf("non-strict 2/0 should fail missing, got ok=%v reason=%q", ok, reason)
	}
	// tool calls present, at least one guard -> ok (lenient)
	if ok, _ := ValidateCoverage(3, 1, false); !ok {
		t.Fatalf("non-strict 3/1 should pass (lenient)")
	}
}

func TestProtectSensitiveStrings(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want bool // expect changed
	}{
		{"bearer", "Authorization: Bearer abcdefghijklmnop1234", true},
		{"openai", "key is sk-abcdefghijklmnop1234567890", true},
		{"anthropic", "sk-ant-abcdefghijklmnop1234567890", true},
		{"github", "ghp_abcdefghijklmnopqrstuvwxyz0123", true},
		{"aws", "AKIAIOSFODNN7EXAMPLE", true},
		{"jsonkey", `{"api_key":"abcdefghijklmnopqrstuvwxyz"}`, true},
		{"plain", "the quick brown fox jumps over", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, changed := ProtectSensitiveStrings(tc.in, false)
			if changed != tc.want {
				t.Fatalf("changed=%v want=%v (out=%q)", changed, tc.want, out)
			}
			if changed && strings.Contains(out, "EXAMPLE") && tc.name == "aws" {
				t.Fatalf("aws secret not redacted: %q", out)
			}
			if changed && !strings.Contains(out, redactedPlaceholder) {
				t.Fatalf("changed but no placeholder: %q", out)
			}
		})
	}
}

func TestProtectSensitiveStringsKeepsJSONStructure(t *testing.T) {
	in := `{"api_key":"abcdefghijklmnopqrstuvwxyz","model":"gpt-5"}`
	out, changed := ProtectSensitiveStrings(in, false)
	if !changed {
		t.Fatalf("expected change")
	}
	if !strings.Contains(out, `"api_key":"`) {
		t.Fatalf("field prefix lost: %q", out)
	}
	if !strings.Contains(out, `"model":"gpt-5"`) {
		t.Fatalf("non-secret field altered: %q", out)
	}
}

func TestConfigNormalized(t *testing.T) {
	c := Config{Enabled: true}.Normalized()
	if c.FailureMode != FailureModeBlock {
		t.Fatalf("default failure mode = %q, want block", c.FailureMode)
	}
	c2 := Config{FailureMode: FailureModeWarn}.Normalized()
	if c2.FailureMode != FailureModeWarn {
		t.Fatalf("warn preserved, got %q", c2.FailureMode)
	}
}

func TestValidateGuardMarkersStrictToolMatch(t *testing.T) {
	raw := []string{`{"name":"aad_guard_abcd1234_Read","tool_name":"Read"}`}
	ok, reason := ValidateGuardMarkers(raw, "abcd1234", []string{"Read"}, true)
	if !ok || reason != "" {
		t.Fatalf("expected strict match, got ok=%v reason=%q", ok, reason)
	}

	ok, reason = ValidateGuardMarkers(raw, "abcd1234", []string{"Write"}, true)
	if ok || reason != "guard_tool_mismatch" {
		t.Fatalf("expected tool mismatch, got ok=%v reason=%q", ok, reason)
	}
}

func TestValidateAndStripOpenAIResponseBlocksMissingGuard(t *testing.T) {
	calls, _ := json.Marshal([]dto.ToolCallResponse{{
		Type: "function",
		Function: dto.FunctionResponse{
			Name:      "Read",
			Arguments: "{}",
		},
	}})
	resp := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{{
			Message: dto.Message{
				Role:      "assistant",
				Content:   "",
				ToolCalls: calls,
			},
			FinishReason: "tool_calls",
		}},
	}

	err := ValidateAndStripOpenAIResponse(resp, Config{Enabled: true, StrictMode: true}, "abcd1234")
	if err == nil {
		t.Fatalf("expected missing guard error")
	}
}

func TestValidateAndStripOpenAIResponseStripsMatchingGuard(t *testing.T) {
	calls, _ := json.Marshal([]dto.ToolCallResponse{{
		Type: "function",
		Function: dto.FunctionResponse{
			Name:      "Read",
			Arguments: "{}",
		},
	}})
	marker := guardOpenTag + `{"name":"aad_guard_abcd1234_Read","tool_name":"Read"}` + guardCloseTag
	resp := &dto.OpenAITextResponse{
		Choices: []dto.OpenAITextResponseChoice{{
			Message: dto.Message{
				Role:      "assistant",
				Content:   marker,
				ToolCalls: calls,
			},
			FinishReason: "tool_calls",
		}},
	}

	err := ValidateAndStripOpenAIResponse(resp, Config{Enabled: true, StrictMode: true, StripOutput: true}, "abcd1234")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(resp.Choices[0].Message.StringContent(), guardOpenTag) {
		t.Fatalf("guard marker leaked: %q", resp.Choices[0].Message.StringContent())
	}
}

func TestValidateAndStripResponsesResponseBlocksMissingGuard(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		Output: []dto.ResponsesOutput{{
			Type: "function_call",
			Name: "Read",
		}},
	}

	err := ValidateAndStripResponsesResponse(resp, Config{Enabled: true, StrictMode: true}, "abcd1234")
	if err == nil {
		t.Fatalf("expected missing guard error")
	}
}

func TestValidateAndStripResponseProof(t *testing.T) {
	marker := responseProofOpenTag + `{"nonce":"n1"}` + responseProofCloseTag
	cleaned, err := ValidateAndStripResponseProof(marker+"actual answer", "n1", Config{Enabled: true, MaxScanBytes: 1024})
	if err != nil {
		t.Fatalf("unexpected proof error: %v", err)
	}
	if cleaned != "actual answer" {
		t.Fatalf("cleaned = %q", cleaned)
	}
}

func TestValidateAndStripResponseProofRejectsWrongNonce(t *testing.T) {
	marker := responseProofOpenTag + `{"nonce":"bad"}` + responseProofCloseTag
	_, err := ValidateAndStripResponseProof(marker+"actual answer", "good", Config{Enabled: true, MaxScanBytes: 1024})
	if err == nil {
		t.Fatalf("expected nonce mismatch")
	}
}

func TestValidateAndStripResponseProofRequiresBeginning(t *testing.T) {
	marker := responseProofOpenTag + `{"nonce":"n1"}` + responseProofCloseTag
	_, err := ValidateAndStripResponseProof("ad first "+marker+"actual answer", "n1", Config{Enabled: true, MaxScanBytes: 1024})
	if err == nil {
		t.Fatalf("expected proof not at beginning")
	}
}

func TestProofStreamValidatorSplitMarker(t *testing.T) {
	v := NewProofStreamValidator("n1", Config{Enabled: true, MaxScanBytes: 1024})
	if out, hold, err := v.ProcessText(responseProofOpenTag + `{"nonce"`); err != nil || !hold || out != "" {
		t.Fatalf("first chunk out=%q hold=%v err=%v", out, hold, err)
	}
	out, hold, err := v.ProcessText(`:"n1"}` + responseProofCloseTag + "hello")
	if err != nil {
		t.Fatalf("unexpected proof error: %v", err)
	}
	if hold {
		t.Fatalf("second chunk should release")
	}
	if out != "hello" {
		t.Fatalf("out=%q", out)
	}
	if !v.Verified() {
		t.Fatalf("validator not verified")
	}
}

func TestProofStreamValidatorFinalMissing(t *testing.T) {
	v := NewProofStreamValidator("n1", Config{Enabled: true, MaxScanBytes: 1024})
	if out, hold, err := v.ProcessText("advertisement"); err != nil || !hold || out != "" {
		t.Fatalf("chunk out=%q hold=%v err=%v", out, hold, err)
	}
	if err := v.Finalize(); err == nil {
		t.Fatalf("expected missing proof")
	}
}

func TestProofStreamValidatorRejectsTextBeforeMarker(t *testing.T) {
	v := NewProofStreamValidator("n1", Config{Enabled: true, MaxScanBytes: 1024})
	_, _, err := v.ProcessText("ad " + responseProofOpenTag + `{"nonce":"n1"}` + responseProofCloseTag)
	if err == nil {
		t.Fatalf("expected proof not at beginning")
	}
}
