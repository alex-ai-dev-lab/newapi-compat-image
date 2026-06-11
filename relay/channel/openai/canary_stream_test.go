package openai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/antipoison"
)

func TestOpenAIStreamCanaryBufferStripsSplitMarker(t *testing.T) {
	buf := &openAIStreamCanaryBuffer{
		nonce: "0123456789abcdef",
		cfg: antipoison.Config{
			Enabled:     true,
			CanaryEcho:  true,
			FailureMode: antipoison.FailureModeBlock,
		}.Normalized(),
	}

	chunks := []string{
		`{"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"role":"assistant"}}]}`,
		`{"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"hello "}}]}`,
		`{"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"world <<NEWAPI_CAN"}}]}`,
		`{"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"ARY_0123456789abcdef>>"}}]}`,
		`{"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
	}
	for _, chunk := range chunks {
		if err := buf.Add(chunk); err != nil {
			t.Fatalf("Add() error = %v", err)
		}
	}

	cleaned, err := buf.Finalize()
	if err != nil {
		t.Fatalf("Finalize() error = %v", err)
	}
	body := strings.Join(cleaned, "\n")
	if strings.Contains(body, "NEWAPI_CANARY") {
		t.Fatalf("canary marker leaked in cleaned stream: %s", body)
	}
	if !strings.Contains(body, `"content":"hello "`) || !strings.Contains(body, `"content":"world "`) {
		t.Fatalf("expected visible content to be preserved, got: %s", body)
	}
}

func TestOpenAIStreamCanaryBufferBlocksMissingMarker(t *testing.T) {
	buf := &openAIStreamCanaryBuffer{
		nonce: "0123456789abcdef",
		cfg: antipoison.Config{
			Enabled:     true,
			CanaryEcho:  true,
			FailureMode: antipoison.FailureModeBlock,
		}.Normalized(),
	}
	if err := buf.Add(`{"id":"chatcmpl-test","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"OpenAI Chat 接口未开启，QQ群广告"}}]}`); err != nil {
		t.Fatalf("Add() error = %v", err)
	}
	if _, err := buf.Finalize(); err == nil {
		t.Fatal("Finalize() error = nil, want canary marker missing")
	}
}
