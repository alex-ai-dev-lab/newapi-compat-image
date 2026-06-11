package antipoison

import (
	"strings"

	"github.com/QuantumNous/new-api/setting/operation_setting"
)

const DefaultStreamPreflightBufferBytes = 2048

type StreamPreflightBuffer struct {
	cfg      Config
	limit    int
	released bool
	chunks   []string
	text     strings.Builder
}

func NewStreamPreflightBuffer(cfg Config) *StreamPreflightBuffer {
	cfg = cfg.Normalized()
	if !cfg.Enabled || cfg.StreamMode != operation_setting.AntiPoisonStreamPreflightFirstBytes {
		return nil
	}
	limit := DefaultStreamPreflightBufferBytes
	if cfg.MaxScanBytes > 0 && cfg.MaxScanBytes < limit {
		limit = cfg.MaxScanBytes
	}
	return &StreamPreflightBuffer{cfg: cfg, limit: limit}
}

func (b *StreamPreflightBuffer) Add(data string, visibleText string) ([]string, OpaqueScanResult, error) {
	if b == nil {
		return []string{data}, OpaqueScanResult{Action: OpaqueActionAllow}, nil
	}
	if b.released {
		return []string{data}, OpaqueScanResult{Action: OpaqueActionAllow}, nil
	}
	if data != "" {
		b.chunks = append(b.chunks, data)
	}
	if visibleText != "" {
		b.text.WriteString(visibleText)
	}
	if b.text.Len() < b.limit {
		return nil, OpaqueScanResult{Action: OpaqueActionAllow}, nil
	}
	return b.release()
}

func (b *StreamPreflightBuffer) Finalize() ([]string, OpaqueScanResult, error) {
	if b == nil || b.released {
		return nil, OpaqueScanResult{Action: OpaqueActionAllow}, nil
	}
	return b.release()
}

func (b *StreamPreflightBuffer) RawData() string {
	if b == nil {
		return ""
	}
	return strings.Join(b.chunks, "\n")
}

func (b *StreamPreflightBuffer) release() ([]string, OpaqueScanResult, error) {
	text := b.text.String()
	if len(text) > b.limit {
		text = text[:b.limit]
	}
	result := ScanOpaquePayload(text, b.cfg, "")
	if err := OpaqueScanError(result); err != nil {
		return nil, result, err
	}
	b.released = true
	out := b.chunks
	b.chunks = nil
	return out, result, nil
}
