package antipoison

import (
	"errors"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestStreamPreflightBufferHoldsAndBlocksRiskyFirstBytes(t *testing.T) {
	cfg := Config{
		Enabled:    true,
		Profile:    operation_setting.AntiPoisonProfileUnknown,
		OpaqueScan: operation_setting.AntiPoisonModeScoreStrict,
		StreamMode: operation_setting.AntiPoisonStreamPreflightFirstBytes,
	}.Normalized()
	buf := NewStreamPreflightBuffer(cfg)
	if buf == nil {
		t.Fatalf("expected preflight buffer")
	}

	blob := strings.Repeat("QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=", 60)
	chunks, result, err := buf.Add("chunk-1", blob)
	if !errors.Is(err, ErrOpaquePayloadSuspicious) {
		t.Fatalf("err=%v, want suspicious opaque payload", err)
	}
	if len(chunks) != 0 {
		t.Fatalf("risky first bytes must not be released, got %v", chunks)
	}
	if result.Action != OpaqueActionRetry {
		t.Fatalf("action=%s score=%d", result.Action, result.Score)
	}
}

func TestStreamPreflightBufferReleasesCleanFirstBytes(t *testing.T) {
	cfg := Config{
		Enabled:    true,
		Profile:    operation_setting.AntiPoisonProfileUnknown,
		OpaqueScan: operation_setting.AntiPoisonModeScore,
		StreamMode: operation_setting.AntiPoisonStreamPreflightFirstBytes,
	}.Normalized()
	buf := NewStreamPreflightBuffer(cfg)
	chunks, _, err := buf.Add("chunk-1", "hello")
	if err != nil {
		t.Fatalf("unexpected add error: %v", err)
	}
	if len(chunks) != 0 {
		t.Fatalf("short first bytes should be buffered, got %v", chunks)
	}
	chunks, result, err := buf.Finalize()
	if err != nil {
		t.Fatalf("unexpected finalize error: %v", err)
	}
	if result.Action != OpaqueActionAllow {
		t.Fatalf("action=%s", result.Action)
	}
	if len(chunks) != 1 || chunks[0] != "chunk-1" {
		t.Fatalf("chunks=%v, want chunk-1", chunks)
	}
}
