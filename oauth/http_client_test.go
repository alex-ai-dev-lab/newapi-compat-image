package oauth

import (
	"io"
	"net/http"
	"strings"
	"testing"
)

func TestReadOAuthResponseBodyRejectsOversize(t *testing.T) {
	res := &http.Response{
		Body: io.NopCloser(strings.NewReader(strings.Repeat("x", int(maxOAuthResponseBytes)+1))),
	}
	if _, err := readOAuthResponseBody(res); err == nil {
		t.Fatal("expected oversize oauth body to fail")
	}
}

func TestDecodeOAuthJSONResponse(t *testing.T) {
	res := &http.Response{
		Body: io.NopCloser(strings.NewReader(`{"access_token":"tok"}`)),
	}
	var out struct {
		AccessToken string `json:"access_token"`
	}
	if err := decodeOAuthJSONResponse(res, &out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out.AccessToken != "tok" {
		t.Fatalf("access_token=%q", out.AccessToken)
	}
}
