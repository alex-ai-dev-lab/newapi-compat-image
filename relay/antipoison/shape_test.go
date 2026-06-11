package antipoison

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestValidateClaudeResponseShape(t *testing.T) {
	cfg := Config{Enabled: true, ShapeCheck: true}

	// Valid response
	resp := &dto.ClaudeResponse{
		Id:         "msg_abc123",
		Model:      "claude-opus-4-6",
		StopReason: "end_turn",
	}
	if err := ValidateClaudeResponseShape(resp, "claude-opus-4", cfg); err != nil {
		t.Fatalf("valid response failed: %v", err)
	}

	// Invalid ID
	badId := &dto.ClaudeResponse{
		Id:    "invalid_id",
		Model: "claude-opus-4",
	}
	if err := ValidateClaudeResponseShape(badId, "claude-opus-4", cfg); err == nil {
		t.Fatalf("expected id validation to fail")
	}

	// Model mismatch
	mismatch := &dto.ClaudeResponse{
		Id:    "msg_abc123",
		Model: "claude-haiku-4",
	}
	if err := ValidateClaudeResponseShape(mismatch, "claude-opus-4", cfg); err == nil {
		t.Fatalf("expected model mismatch to fail")
	}

	// Unknown stop_reason
	badStop := &dto.ClaudeResponse{
		Id:         "msg_abc123",
		Model:      "claude-opus-4",
		StopReason: "unknown_reason",
	}
	if err := ValidateClaudeResponseShape(badStop, "claude-opus-4", cfg); err == nil {
		t.Fatalf("expected stop_reason validation to fail")
	}
}

func TestValidateOpenAIResponseShape(t *testing.T) {
	cfg := Config{Enabled: true, ShapeCheck: true}

	// Valid response
	resp := &dto.OpenAITextResponse{
		Id:     "chatcmpl-abc123",
		Object: "chat.completion",
		Model:  "gpt-4o",
		Choices: []dto.OpenAITextResponseChoice{
			{FinishReason: "stop"},
		},
	}
	if err := ValidateOpenAIResponseShape(resp, "gpt-4o", cfg); err != nil {
		t.Fatalf("valid response failed: %v", err)
	}

	// Valid response converted from the OpenAI Responses API.
	responsesBacked := &dto.OpenAITextResponse{
		Id:     "resp_d187261eaef159fa6c702cb53d44ae0c81a8a206c0d58199e9",
		Object: "chat.completion",
		Model:  "gpt-5",
		Choices: []dto.OpenAITextResponseChoice{
			{FinishReason: "stop"},
		},
	}
	if err := ValidateOpenAIResponseShape(responsesBacked, "gpt-5.5", cfg); err != nil {
		t.Fatalf("responses-backed chat response failed: %v", err)
	}

	// Invalid ID
	badId := &dto.OpenAITextResponse{
		Id:     "invalid_id",
		Object: "chat.completion",
		Model:  "gpt-4o",
	}
	if err := ValidateOpenAIResponseShape(badId, "gpt-4o", cfg); err == nil {
		t.Fatalf("expected id validation to fail")
	}

	// Invalid object
	badObject := &dto.OpenAITextResponse{
		Id:     "chatcmpl-abc123",
		Object: "invalid.object",
		Model:  "gpt-4o",
	}
	if err := ValidateOpenAIResponseShape(badObject, "gpt-4o", cfg); err == nil {
		t.Fatalf("expected object validation to fail")
	}

	// Unknown finish_reason
	badFinish := &dto.OpenAITextResponse{
		Id:     "chatcmpl-abc123",
		Object: "chat.completion",
		Model:  "gpt-4o",
		Choices: []dto.OpenAITextResponseChoice{
			{FinishReason: "unknown"},
		},
	}
	if err := ValidateOpenAIResponseShape(badFinish, "gpt-4o", cfg); err == nil {
		t.Fatalf("expected finish_reason validation to fail")
	}
}

func TestValidateResponsesResponseShape(t *testing.T) {
	cfg := Config{Enabled: true, ShapeCheck: true}

	// Valid response
	resp := &dto.OpenAIResponsesResponse{
		ID:     "resp_abc123",
		Object: "response",
		Model:  "gpt-4o",
	}
	if err := ValidateResponsesResponseShape(resp, "gpt-4o", cfg); err != nil {
		t.Fatalf("valid response failed: %v", err)
	}

	// Invalid ID
	badId := &dto.OpenAIResponsesResponse{
		ID:     "invalid_id",
		Object: "response",
		Model:  "gpt-4o",
	}
	if err := ValidateResponsesResponseShape(badId, "gpt-4o", cfg); err == nil {
		t.Fatalf("expected id validation to fail")
	}

	// Invalid object
	badObject := &dto.OpenAIResponsesResponse{
		ID:     "resp_abc123",
		Object: "invalid",
		Model:  "gpt-4o",
	}
	if err := ValidateResponsesResponseShape(badObject, "gpt-4o", cfg); err == nil {
		t.Fatalf("expected object validation to fail")
	}
}

func TestModelMatchesClaude(t *testing.T) {
	cases := []struct {
		response string
		request  string
		want     bool
	}{
		{"claude-opus-4-6", "claude-opus-4", true},
		{"claude-sonnet-4", "claude-sonnet-4-6", true},
		{"claude-haiku-4", "claude-opus-4", false}, // tier mismatch
		{"gpt-4o", "claude-opus-4", false},         // not claude
	}
	for _, tc := range cases {
		got := modelMatchesClaude(tc.response, tc.request)
		if got != tc.want {
			t.Errorf("modelMatchesClaude(%q, %q) = %v, want %v", tc.response, tc.request, got, tc.want)
		}
	}
}

func TestModelMatchesOpenAI(t *testing.T) {
	cases := []struct {
		response string
		request  string
		want     bool
	}{
		{"gpt-4o", "gpt-4o", true},
		{"gpt-4o-2024-05-13", "gpt-4o", true},
		{"gpt-4o", "gpt-4o-2024-05-13", true},
		{"gpt-5", "gpt-5.5", true},
		{"o1-mini", "o1-mini-2024-09-12", true},
		{"gpt-3.5-turbo", "gpt-4o", false},
	}
	for _, tc := range cases {
		got := modelMatchesOpenAI(tc.response, tc.request)
		if got != tc.want {
			t.Errorf("modelMatchesOpenAI(%q, %q) = %v, want %v", tc.response, tc.request, got, tc.want)
		}
	}
}
