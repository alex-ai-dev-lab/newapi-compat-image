package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestSanitizeClaudeThinkingRequestRemovesUnsupportedThinking(t *testing.T) {
	req := &dto.ClaudeRequest{
		Thinking: &dto.Thinking{Type: "enabled"},
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []map[string]any{
					{"type": "thinking", "thinking": "internal", "signature": "sig"},
					{"type": "redacted_thinking", "data": "opaque"},
					{"type": "text", "text": "visible"},
				},
			},
		},
	}

	result := SanitizeClaudeThinkingRequest(req, false)

	require.True(t, result.Changed)
	require.True(t, result.RemovedRequestThinking)
	require.Equal(t, 1, result.RemovedThinkingBlocks)
	require.Equal(t, 1, result.RemovedRedactedThinking)
	require.Nil(t, req.Thinking)
	blocks, ok := claudeContentToBlocks(req.Messages[0].Content)
	require.True(t, ok)
	require.Len(t, blocks, 1)
	require.Equal(t, "text", blocks[0]["type"])
}

func TestSanitizeClaudeThinkingRequestKeepsValidThinkingForSupportedChannel(t *testing.T) {
	req := &dto.ClaudeRequest{
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []map[string]any{
					{"type": "thinking", "thinking": "internal", "signature": "sig"},
					{"type": "redacted_thinking", "data": "opaque"},
				},
			},
		},
	}

	result := SanitizeClaudeThinkingRequest(req, true)

	require.False(t, result.Changed)
	blocks, ok := claudeContentToBlocks(req.Messages[0].Content)
	require.True(t, ok)
	require.Len(t, blocks, 2)
	require.Equal(t, "sig", blocks[0]["signature"])
}

func TestSanitizeClaudeThinkingRequestRemovesInvalidThinkingEvenWhenSupported(t *testing.T) {
	req := &dto.ClaudeRequest{
		Messages: []dto.ClaudeMessage{
			{
				Role: "assistant",
				Content: []map[string]any{
					{"type": "thinking", "signature": "sig"},
					{"type": "text", "text": "visible"},
				},
			},
		},
	}

	result := SanitizeClaudeThinkingRequest(req, true)

	require.True(t, result.Changed)
	require.Equal(t, 1, result.RemovedInvalidThinkingBlock)
	blocks, ok := claudeContentToBlocks(req.Messages[0].Content)
	require.True(t, ok)
	require.Len(t, blocks, 1)
	require.Equal(t, "text", blocks[0]["type"])
}

func TestClaudeRequestHasThinkingDetectsRequestThinkingParameter(t *testing.T) {
	req := &dto.ClaudeRequest{
		Thinking: &dto.Thinking{Type: "enabled"},
		Messages: []dto.ClaudeMessage{
			{
				Role:    "user",
				Content: "hello",
			},
		},
	}

	require.True(t, ClaudeRequestHasThinking(req))
}

func TestChannelSupportsClaudeThinkingInfersAndHonorsOverrides(t *testing.T) {
	anthropic := &model.Channel{Type: constant.ChannelTypeAnthropic}
	require.True(t, ChannelSupportsClaudeThinking(anthropic))

	falseValue := false
	anthropic.SetSetting(dto.ChannelSettings{SupportsClaudeThinking: &falseValue})
	require.False(t, ChannelSupportsClaudeThinking(anthropic))

	openai := &model.Channel{Type: constant.ChannelTypeOpenAI}
	require.False(t, ChannelSupportsClaudeThinking(openai))

	trueValue := true
	openai.SetSetting(dto.ChannelSettings{SupportsClaudeThinking: &trueValue})
	require.True(t, ChannelSupportsClaudeThinking(openai))
}
