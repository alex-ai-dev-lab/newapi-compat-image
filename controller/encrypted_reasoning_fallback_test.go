package controller

import (
	"errors"
	"net/http"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/assert"
)

func TestShouldCompatRetryByError_InvalidEncryptedContent(t *testing.T) {
	err := types.NewOpenAIError(
		errors.New("invalid_encrypted_content"),
		types.ErrorCodeBadResponseStatusCode,
		http.StatusBadRequest,
	)

	assert.True(t, shouldCompatRetryByError(err))
	assert.True(t, shouldCompatExcludeChannelForRetry(err))
	assert.False(t, shouldCompatDisableChannel(err))
}

func TestCompatStreamRetryError_PreFirstChunkHandlerStop(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.RecordError("invalid_encrypted_content")
	status.SetEndReason(relaycommon.StreamEndReasonHandlerStop, nil)
	info := &relaycommon.RelayInfo{
		IsStream:              true,
		ReceivedResponseCount: 0,
		StreamStatus:          status,
	}

	err := compatStreamRetryError(info)

	if assert.NotNil(t, err) {
		assert.Equal(t, http.StatusBadGateway, err.StatusCode)
	}
}

func TestCompatStreamRetryError_AfterChunkHandlerStopNoRetry(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.RecordError("invalid_encrypted_content")
	status.SetEndReason(relaycommon.StreamEndReasonHandlerStop, nil)
	info := &relaycommon.RelayInfo{
		IsStream:              true,
		ReceivedResponseCount: 1,
		StreamStatus:          status,
	}

	assert.Nil(t, compatStreamRetryError(info))
}
