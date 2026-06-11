package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/antipoison"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func TestPersistAntiPoisonEvidenceIncludesRiskFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tmp := t.TempDir()
	oldLogDir := common.LogDir
	common.LogDir = &tmp
	t.Cleanup(func() { common.LogDir = oldLogDir })
	t.Setenv("NEWAPI_SKIP_EVIDENCE_DB_UPDATE", "true")

	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer secret-token")
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = req
	ctx.Set(common.RequestIdKey, "req-test")
	ctx.Set("original_model", "gpt-test")
	ctx.Set("id", 42)
	ctx.Set("token_id", 7)
	ctx.Set("token_name", "integration")
	ctx.Set("group", "default")
	common.SetContextKey(ctx, constant.ContextKeyChannelSetting, dto.ChannelSettings{AntiPoisonProfile: "probation"})
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonRiskLevel, antipoison.RiskHard)
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonRiskSignal, "answer_envelope_outside_text")
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonActionTaken, "block")
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonStreamMode, "aggregate_then_replay")
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonOpaqueScore, 95)
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonOpaqueHits, []string{"zero_width"})
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonEnvelopeResult, antipoison.ResultFail)
	common.SetContextKey(ctx, constant.ContextKeyAntiPoisonEvidenceResponse, "dirty upstream body")

	path := persistAntiPoisonEvidence(ctx, *types.NewChannelError(101, 1, "test-channel", false, "", true), types.NewError(errors.New("answer envelope outside text"), types.ErrorCodeAntiPoisonValidationFailed))
	if path == "" {
		t.Fatalf("expected evidence path")
	}
	if filepath.Dir(path) != filepath.Join(tmp, "anti-poison", "channel-101") {
		t.Fatalf("path=%s", path)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read evidence: %v", err)
	}
	var payload antiPoisonEvidencePayload
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatalf("unmarshal evidence: %v", err)
	}
	if payload.Profile != "probation" || payload.RiskLevel != antipoison.RiskHard || payload.RiskSignal != "answer_envelope_outside_text" {
		t.Fatalf("payload risk fields not persisted: %+v", payload)
	}
	if payload.StreamMode != "aggregate_then_replay" || payload.OpaqueScore != 95 || len(payload.OpaqueHits) != 1 || payload.OpaqueHits[0] != "zero_width" {
		t.Fatalf("payload scanner fields not persisted: %+v", payload)
	}
	if got := payload.RequestHeadersPreview["Authorization"]; len(got) != 1 || got[0] != "***masked***" {
		t.Fatalf("authorization header not masked: %#v", got)
	}
	if payload.UpstreamBodyPreview.Text != "dirty upstream body" {
		t.Fatalf("upstream preview=%q", payload.UpstreamBodyPreview.Text)
	}
}
