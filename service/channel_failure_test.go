package service

import (
	"errors"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/types"
)

func TestNotImplementedIsModelScopedChannelFailure(t *testing.T) {
	oldAutomaticDisable := common.AutomaticDisableChannelEnabled
	common.AutomaticDisableChannelEnabled = true
	t.Cleanup(func() {
		common.AutomaticDisableChannelEnabled = oldAutomaticDisable
	})

	err := types.NewErrorWithStatusCode(
		errors.New("not implemented"),
		types.ErrorCodeConvertRequestFailed,
		http.StatusInternalServerError,
	)

	if !IsChannelFailureError(err) {
		t.Fatal("not implemented 500 should be treated as a channel failure")
	}
	if !IsModelScopedChannelFailureError(err) {
		t.Fatal("not implemented 500 should be treated as a model-scoped channel failure")
	}
	if ShouldDisableChannel(err) {
		t.Fatal("not implemented 500 should disable the channel-model, not the whole channel")
	}
}

func TestTLSVerificationErrorIsNotChannelFailure(t *testing.T) {
	err := types.NewError(
		errors.New("tls: failed to verify certificate: x509: certificate signed by unknown authority"),
		types.ErrorCodeDoRequestFailed,
	)

	if IsChannelFailureError(err) {
		t.Fatal("TLS verification errors should not be treated as channel failures")
	}
}
