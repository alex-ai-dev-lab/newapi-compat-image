package openai

import (
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/antipoison"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

type openAIStreamCanaryBuffer struct {
	nonce   string
	cfg     antipoison.Config
	chunks  []string
	text    strings.Builder
	sawText bool
}

func newOpenAIStreamCanaryBuffer(info *relaycommon.RelayInfo) *openAIStreamCanaryBuffer {
	if info == nil || info.AntiPoisonCanaryNonce == "" {
		return nil
	}
	cfg := antipoison.ResponseGuardConfig(info)
	if !cfg.Enabled || !cfg.CanaryEcho {
		return nil
	}
	return &openAIStreamCanaryBuffer{
		nonce: info.AntiPoisonCanaryNonce,
		cfg:   cfg,
	}
}

func (b *openAIStreamCanaryBuffer) Add(data string) error {
	if b == nil || data == "" {
		return nil
	}
	b.chunks = append(b.chunks, data)

	var chunk dto.ChatCompletionsStreamResponse
	if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
		return err
	}
	for _, choice := range chunk.Choices {
		if choice.Delta.Content == nil {
			continue
		}
		text := choice.Delta.GetContentString()
		if text == "" {
			continue
		}
		b.sawText = true
		b.text.WriteString(text)
	}
	return nil
}

func (b *openAIStreamCanaryBuffer) Finalize() ([]string, error) {
	if b == nil {
		return nil, nil
	}
	if !b.sawText {
		return append([]string(nil), b.chunks...), nil
	}

	cleaned, err := antipoison.ValidateAndStripCanary(b.text.String(), b.nonce, b.cfg)
	if err != nil {
		if b.cfg.FailureMode == antipoison.FailureModeWarn {
			common.SysLog("canary stream validation warning: " + err.Error())
			return append([]string(nil), b.chunks...), nil
		}
		return nil, err
	}
	return rewriteOpenAIStreamChunksText(b.chunks, cleaned)
}

func (b *openAIStreamCanaryBuffer) RawText() string {
	if b == nil {
		return ""
	}
	return strings.Join(b.chunks, "\n")
}

func rewriteOpenAIStreamChunksText(chunks []string, cleanedText string) ([]string, error) {
	out := make([]string, 0, len(chunks))
	remaining := cleanedText

	for _, data := range chunks {
		var chunk dto.ChatCompletionsStreamResponse
		if err := common.UnmarshalJsonStr(data, &chunk); err != nil {
			return nil, err
		}

		changed := false
		for i := range chunk.Choices {
			delta := &chunk.Choices[i].Delta
			if delta.Content == nil {
				continue
			}
			original := delta.GetContentString()
			if original == "" {
				continue
			}

			next := ""
			if len(remaining) >= len(original) {
				next = remaining[:len(original)]
				remaining = remaining[len(original):]
			} else {
				next = remaining
				remaining = ""
			}
			delta.SetContentString(next)
			changed = true
		}

		if !changed {
			out = append(out, data)
			continue
		}
		encoded, err := common.Marshal(chunk)
		if err != nil {
			return nil, err
		}
		out = append(out, string(encoded))
	}

	if remaining != "" {
		return nil, fmt.Errorf("canary stream rewrite left %d bytes unassigned", len(remaining))
	}
	return out, nil
}
