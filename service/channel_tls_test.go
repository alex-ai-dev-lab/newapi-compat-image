package service

import (
	"context"
	"crypto/x509"
	"errors"
	"net"
	"net/url"
	"testing"

	"github.com/QuantumNous/new-api/types"
)

func TestIsTLSVerificationRawError(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "unknown authority",
			err:  &x509.UnknownAuthorityError{},
			want: true,
		},
		{
			name: "certificate invalid",
			err: &x509.CertificateInvalidError{
				Reason: x509.Expired,
			},
			want: true,
		},
		{
			name: "hostname mismatch",
			err: &x509.HostnameError{
				Host: "127.0.0.1",
			},
			want: true,
		},
		{
			name: "tls verification message fallback",
			err:  errors.New("tls: failed to verify certificate: x509: certificate signed by unknown authority"),
			want: true,
		},
		{
			name: "deadline exceeded",
			err:  context.DeadlineExceeded,
			want: false,
		},
		{
			name: "connection refused",
			err: &url.Error{
				Op:  "Get",
				URL: "https://example.com",
				Err: errors.New("dial tcp 127.0.0.1:9: connect: connection refused"),
			},
			want: false,
		},
		{
			name: "dns error",
			err: &net.DNSError{
				Err:        "no such host",
				Name:       "example.invalid",
				IsNotFound: true,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsTLSVerificationRawError(tt.err); got != tt.want {
				t.Fatalf("IsTLSVerificationRawError() = %v, want %v, err=%v", got, tt.want, tt.err)
			}
		})
	}
}

func TestIsTLSVerificationErrorReusesRawDetection(t *testing.T) {
	t.Parallel()

	err := types.NewError(&x509.UnknownAuthorityError{}, types.ErrorCodeDoRequestFailed)
	if !IsTLSVerificationError(err) {
		t.Fatal("expected NewAPIError wrapping x509.UnknownAuthorityError to be treated as TLS verification error")
	}
}
