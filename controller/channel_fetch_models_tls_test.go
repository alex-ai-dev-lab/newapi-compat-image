package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func resetFetchModelsTLSTestState(t *testing.T) {
	t.Helper()
	oldTLSInsecureSkipVerify := common.TLSInsecureSkipVerify
	oldRelayTimeout := common.RelayTimeout
	t.Setenv("HTTP_PROXY", "")
	t.Setenv("HTTPS_PROXY", "")
	t.Setenv("ALL_PROXY", "")
	t.Setenv("NO_PROXY", "")

	common.TLSInsecureSkipVerify = false
	common.RelayTimeout = 0
	service.ResetProxyClientCache()
	service.InitHttpClient()

	t.Cleanup(func() {
		common.TLSInsecureSkipVerify = oldTLSInsecureSkipVerify
		common.RelayTimeout = oldRelayTimeout
		service.ResetProxyClientCache()
		service.InitHttpClient()
	})
}

func TestFetchModelsUsesTLSInsecureSkipVerifySetting(t *testing.T) {
	resetFetchModelsTLSTestState(t)
	gin.SetMode(gin.TestMode)

	server := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/models" {
			t.Fatalf("path = %s, want /v1/models", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"data":[{"id":"gpt-test"}]}`))
	}))
	defer server.Close()

	result := performFetchModelsRequest(t, map[string]any{
		"base_url": server.URL,
		"type":     constant.ChannelTypeOpenAI,
		"key":      "test-key",
	})
	if success, _ := result["success"].(bool); success {
		t.Fatalf("expected strict TLS fetch to fail, got %#v", result)
	}

	result = performFetchModelsRequest(t, map[string]any{
		"base_url": server.URL,
		"type":     constant.ChannelTypeOpenAI,
		"key":      "test-key",
		"setting":  `{"tls_insecure_skip_verify":true}`,
	})
	if success, _ := result["success"].(bool); !success {
		t.Fatalf("expected TLS skip fetch to succeed, got %#v", result)
	}
	data, ok := result["data"].([]any)
	if !ok || len(data) != 1 || data[0] != "gpt-test" {
		t.Fatalf("data = %#v, want [gpt-test]", result["data"])
	}
}

func performFetchModelsRequest(t *testing.T, payload map[string]any) map[string]any {
	t.Helper()
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/channel/fetch_models", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")

	FetchModels(c)

	var result map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	return result
}
