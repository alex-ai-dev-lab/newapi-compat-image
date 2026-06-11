package service

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func setClientIdentityOptionForTest(t *testing.T, setting model.ClientIdentitySetting) {
	t.Helper()
	data, err := json.Marshal(setting)
	if err != nil {
		t.Fatal(err)
	}
	common.OptionMapRWMutex.Lock()
	if common.OptionMap == nil {
		common.OptionMap = map[string]string{}
	}
	original, existed := common.OptionMap["client_identity_setting"]
	common.OptionMap["client_identity_setting"] = string(data)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		if existed {
			common.OptionMap["client_identity_setting"] = original
		} else {
			delete(common.OptionMap, "client_identity_setting")
		}
		common.OptionMapRWMutex.Unlock()
	})
}

func baseClientIdentitySetting() model.ClientIdentitySetting {
	return model.ClientIdentitySetting{
		Enabled:                   true,
		ApplyToAllOpenAIResponses: false,
		ApplyToAllClaudeMessages:  false,
		Codex: model.CodexIdentityConfig{
			Enabled:        true,
			Mode:           model.IdentityModeForceGlobal,
			InstallationID: "codex-fixed",
		},
		Claude: model.ClaudeIdentityConfig{
			Enabled:           true,
			Mode:              model.IdentityModeForceGlobal,
			DeviceID:          "claude-device-fixed",
			SessionIDMode:     model.SessionIDModeForceGlobal,
			FixedSessionID:    "claude-session-fixed",
			SyncSessionHeader: true,
		},
	}
}

func TestApplyClientIdentityForcesCodexInstallationID(t *testing.T) {
	setClientIdentityOptionForTest(t, baseClientIdentitySetting())

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("User-Agent", "codex-cli/0.137.0")
	body := []byte(`{"client_metadata":{"x-codex-installation-id":"client-id"},"input":"hello"}`)

	modified, changed, err := ApplyClientIdentityToRequest("/v1/responses", headers, body)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("expected request body to change")
	}

	var payload map[string]any
	if err := json.Unmarshal(modified, &payload); err != nil {
		t.Fatal(err)
	}
	metadata := payload["client_metadata"].(map[string]any)
	if got := metadata["x-codex-installation-id"]; got != "codex-fixed" {
		t.Fatalf("codex installation id = %v, want codex-fixed", got)
	}
}

func TestApplyClientIdentityDoesNotAddCodexIDToPlainChatByDefault(t *testing.T) {
	setClientIdentityOptionForTest(t, baseClientIdentitySetting())

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("User-Agent", "codex-cli/0.137.0")
	body := []byte(`{"model":"gpt-5.4","messages":[{"role":"user","content":"hi"}]}`)

	modified, changed, err := ApplyClientIdentityToRequest("/v1/chat/completions", headers, body)
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Fatalf("plain chat request changed unexpectedly: %s", string(modified))
	}
}

func TestApplyClientIdentityForcesCodexIDForCodexChatUpstream(t *testing.T) {
	setClientIdentityOptionForTest(t, baseClientIdentitySetting())

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	body := []byte(`{"model":"gpt-5.4","messages":[{"role":"user","content":"hi"}]}`)

	modified, changed, err := ApplyClientIdentityToRequestWithOptions(
		"/v1/chat/completions",
		headers,
		body,
		ClientIdentityOptions{ForceCodexIdentity: true},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Fatal("expected Codex identity to be added for forced chat request")
	}

	var payload map[string]any
	if err := json.Unmarshal(modified, &payload); err != nil {
		t.Fatal(err)
	}
	metadata := payload["client_metadata"].(map[string]any)
	if got := metadata["x-codex-installation-id"]; got != "codex-fixed" {
		t.Fatalf("codex installation id = %v, want codex-fixed", got)
	}
}

func TestApplyClientIdentityDoesNotAddCodexMetadataToClaudeMessages(t *testing.T) {
	setClientIdentityOptionForTest(t, baseClientIdentitySetting())

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("User-Agent", "claude-cli/2.1.167 (external, cli)")
	body := []byte(`{"model":"claude-opus-4-6","messages":[{"role":"user","content":"hi"}]}`)

	modified, changed, err := ApplyClientIdentityToRequestWithOptions(
		"/v1/messages",
		headers,
		body,
		ClientIdentityOptions{ForceCodexIdentity: true},
	)
	if err != nil {
		t.Fatal(err)
	}

	var payload map[string]any
	if err := json.Unmarshal(modified, &payload); err != nil {
		t.Fatal(err)
	}
	if _, ok := payload["client_metadata"]; ok {
		t.Fatalf("claude request should not contain client_metadata: %s", string(modified))
	}
	if !changed {
		t.Fatal("expected Claude metadata identity to be applied")
	}
	if _, ok := payload["metadata"]; !ok {
		t.Fatalf("expected Claude metadata to be present: %s", string(modified))
	}
}

func TestApplyClientIdentityForcesClaudeDeviceSessionAndHeader(t *testing.T) {
	setClientIdentityOptionForTest(t, baseClientIdentitySetting())

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	headers.Set("User-Agent", "claude-cli/2.1.167 (external, cli)")
	headers.Set("X-Claude-Code-Session-Id", "client-session")
	body := strings.NewReader(`{"metadata":{"user_id":"{\"device_id\":\"client-device\",\"session_id\":\"client-session\"}"},"messages":[]}`)

	modifiedReader, _, headerPatch, err := ApplyClientIdentityToRequestBody("/v1/messages", headers, body)
	if err != nil {
		t.Fatal(err)
	}
	modified, err := io.ReadAll(modifiedReader)
	if err != nil {
		t.Fatal(err)
	}

	var payload map[string]any
	if err := json.Unmarshal(modified, &payload); err != nil {
		t.Fatal(err)
	}
	metadata := payload["metadata"].(map[string]any)
	var userID map[string]any
	if err := json.Unmarshal([]byte(metadata["user_id"].(string)), &userID); err != nil {
		t.Fatal(err)
	}
	if got := userID["device_id"]; got != "claude-device-fixed" {
		t.Fatalf("claude device_id = %v, want claude-device-fixed", got)
	}
	if got := userID["session_id"]; got != "claude-session-fixed" {
		t.Fatalf("claude session_id = %v, want claude-session-fixed", got)
	}
	if got := headerPatch.Get("X-Claude-Code-Session-Id"); got != "claude-session-fixed" {
		t.Fatalf("header patch session = %q, want claude-session-fixed", got)
	}
}

func TestApplyClientIdentityAppliesGenericHeader(t *testing.T) {
	setting := baseClientIdentitySetting()
	setting.Codex.Enabled = false
	setting.Claude.Enabled = false
	setting.Generic = []model.GenericIdentityConfig{
		{
			Name:       "Custom",
			Enabled:    true,
			Mode:       model.IdentityModeForceGlobal,
			PathType:   model.PathTypeHeader,
			FieldPath:  "X-Device-Id",
			FieldValue: "generic-fixed",
		},
	}
	setClientIdentityOptionForTest(t, setting)

	headers := http.Header{}
	headers.Set("Content-Type", "application/json")
	body := strings.NewReader(`{"messages":[]}`)

	_, _, headerPatch, err := ApplyClientIdentityToRequestBody("/v1/chat/completions", headers, body)
	if err != nil {
		t.Fatal(err)
	}
	if got := headerPatch.Get("X-Device-Id"); got != "generic-fixed" {
		t.Fatalf("generic header = %q, want generic-fixed", got)
	}
}
