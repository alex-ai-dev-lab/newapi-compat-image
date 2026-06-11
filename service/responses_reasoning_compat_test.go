package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestSanitizeResponsesReasoningContentRemovesOnlyReasoningContent(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Input: common.StringToByteSlice(`[
			{"type":"reasoning","id":"rs_1","summary":[],"content":[{"type":"summary_text","text":"probe summary"}]},
			{"type":"message","role":"user","content":[{"type":"input_text","text":"keep me"}]},
			{"type":"reasoning","id":"rs_2","summary":[],"content":[]}
		]`),
	}

	result := SanitizeResponsesReasoningContent(req)

	require.True(t, result.Changed)
	assert.Equal(t, 1, result.RemovedReasoningContent)
	assert.False(t, gjson.GetBytes(req.Input, `0.content`).Exists())
	assert.Equal(t, "keep me", gjson.GetBytes(req.Input, `1.content.0.text`).String())
	assert.True(t, gjson.GetBytes(req.Input, `2.content`).Exists())
	assert.Len(t, gjson.GetBytes(req.Input, `2.content`).Array(), 0)
}

func TestSanitizeResponsesReasoningContentKeepsCleanRequest(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Input: common.StringToByteSlice(`[
			{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]},
			{"type":"reasoning","id":"rs_1","summary":[]}
		]`),
	}

	result := SanitizeResponsesReasoningContent(req)

	require.False(t, result.Changed)
	assert.JSONEq(t, `[
		{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]},
		{"type":"reasoning","id":"rs_1","summary":[]}
	]`, string(req.Input))
}
