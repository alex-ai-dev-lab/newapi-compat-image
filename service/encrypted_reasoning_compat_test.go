package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestAnalyzeEncryptedReasoningRequest(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Include:            common.StringToByteSlice(`["reasoning.encrypted_content"]`),
		PreviousResponseID: "resp_123",
		Input: common.StringToByteSlice(`[
			{"type":"message","role":"user","content":"hi"},
			{"type":"reasoning","encrypted_content":"secret"}
		]`),
	}

	info := AnalyzeEncryptedReasoningRequest(req)

	assert.True(t, info.HasEncryptedReasoning)
	assert.True(t, info.HasReasoningItem)
	assert.True(t, info.HasPreviousResponseID)
	assert.True(t, ShouldUseEncryptedReasoningCompat(req))
}

func TestScrubEncryptedReasoningRequest(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Include:            common.StringToByteSlice(`["reasoning.encrypted_content","message.output_text"]`),
		PreviousResponseID: "resp_123",
		Input: common.StringToByteSlice(`[
			{"type":"message","role":"user","content":[{"type":"input_text","text":"hi"}]},
			{"type":"reasoning","id":"rs_1","encrypted_content":"secret","summary":[]},
			{"type":"function_call","call_id":"call_1","name":"lookup","arguments":"{}","reasoning":"rs_1"},
			{"type":"function_call_output","call_id":"call_1","output":"stale","reasoning_id":"rs_1"},
			{"type":"message","role":"assistant","content":[{"type":"output_text","text":"visible","encrypted_content":"nested-secret"}]},
			{"type":"function_call_output","call_id":"call_1","output":"ok"}
		]`),
	}

	result := ScrubEncryptedReasoningRequest(req)

	require.True(t, result.Changed)
	assert.Equal(t, 1, result.RemovedIncludeEntries)
	assert.Equal(t, 3, result.RemovedReasoningItems)
	assert.Equal(t, 1, result.RemovedEncryptedFields)
	assert.True(t, result.RemovedPreviousResponse)
	assert.Empty(t, req.PreviousResponseID)
	assert.JSONEq(t, `["message.output_text"]`, string(req.Include))
	assert.False(t, gjson.GetBytes(req.Input, `#(type=="reasoning")`).Exists())
	assert.False(t, gjson.GetBytes(req.Input, `#(type=="function_call")`).Exists())
	assert.False(t, gjson.GetBytes(req.Input, `#(reasoning_id=="rs_1")`).Exists())
	assert.False(t, gjson.GetBytes(req.Input, `1.content.0.encrypted_content`).Exists())
	assert.Equal(t, "hi", gjson.GetBytes(req.Input, `0.content.0.text`).String())
	assert.Equal(t, "visible", gjson.GetBytes(req.Input, `1.content.0.text`).String())
	assert.Equal(t, "ok", gjson.GetBytes(req.Input, `2.output`).String())
}

func TestScrubEncryptedReasoningRequest_KeepsCleanRequest(t *testing.T) {
	req := &dto.OpenAIResponsesRequest{
		Include: common.StringToByteSlice(`["message.output_text"]`),
		Input:   common.StringToByteSlice(`[{"type":"message","role":"user","content":"hi"}]`),
	}

	result := ScrubEncryptedReasoningRequest(req)

	assert.False(t, result.Changed)
	assert.JSONEq(t, `["message.output_text"]`, string(req.Include))
	assert.JSONEq(t, `[{"type":"message","role":"user","content":"hi"}]`, string(req.Input))
}

func TestShouldFallbackEncryptedReasoningError(t *testing.T) {
	assert.True(t, ShouldFallbackEncryptedReasoningError(
		types.NewOpenAIError(errors.New("invalid_encrypted_content"), types.ErrorCodeBadResponseStatusCode, http.StatusBadRequest),
	))
	assert.True(t, ShouldFallbackEncryptedReasoningError(
		types.NewOpenAIError(errors.New("The encrypted content QVhO...eQ== could not be verified. Reason: Encrypted content could not be decrypted or parsed."), types.ErrorCodeBadResponseBody, http.StatusBadRequest),
	))
	assert.True(t, ShouldFallbackEncryptedReasoningError(
		types.NewOpenAIError(errors.New("quota exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	assert.False(t, ShouldFallbackEncryptedReasoningError(
		types.NewOpenAIError(errors.New("bad user input"), types.ErrorCodeInvalidRequest, http.StatusBadRequest),
	))
}

func TestIsInvalidEncryptedReasoningError(t *testing.T) {
	assert.True(t, IsInvalidEncryptedReasoningError(
		types.NewOpenAIError(errors.New("Encrypted content could not be decrypted or parsed"), types.ErrorCodeBadResponseBody, http.StatusBadRequest),
	))
	assert.True(t, IsInvalidEncryptedReasoningError(
		types.NewOpenAIError(errors.New("The encrypted content QVhO...eQ== could not be verified. Reason: Encrypted content could not be decrypted or parsed."), types.ErrorCodeBadResponseBody, http.StatusBadRequest),
	))
	assert.False(t, IsInvalidEncryptedReasoningError(
		types.NewOpenAIError(errors.New("quota exceeded"), types.ErrorCodeBadResponseStatusCode, http.StatusTooManyRequests),
	))
	assert.False(t, IsInvalidEncryptedReasoningError(
		types.NewOpenAIError(errors.New("signature could not be verified"), types.ErrorCodeBadResponseBody, http.StatusBadRequest),
	))
	assert.False(t, ShouldFallbackEncryptedReasoningError(
		types.NewOpenAIError(errors.New("signature could not be verified"), types.ErrorCodeBadResponseBody, http.StatusBadRequest),
	))
}
