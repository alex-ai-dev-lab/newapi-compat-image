package antipoison

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/gin-gonic/gin"
)

const (
	RiskSoft       = "soft"
	RiskSuspicious = "suspicious"
	RiskHard       = "hard"

	ResultPass = "pass"
	ResultWarn = "warn"
	ResultFail = "fail"
)

func RecordRisk(c *gin.Context, level string, signal string, action string) {
	if c == nil {
		return
	}
	if strings.TrimSpace(level) != "" {
		common.SetContextKey(c, constant.ContextKeyAntiPoisonRiskLevel, level)
	}
	if strings.TrimSpace(signal) != "" {
		common.SetContextKey(c, constant.ContextKeyAntiPoisonRiskSignal, signal)
	}
	if strings.TrimSpace(action) != "" {
		common.SetContextKey(c, constant.ContextKeyAntiPoisonActionTaken, action)
	}
}

func RecordResult(c *gin.Context, key constant.ContextKey, result string) {
	if c == nil || strings.TrimSpace(result) == "" {
		return
	}
	common.SetContextKey(c, key, result)
}

func RecordStreamMode(c *gin.Context, cfg Config) {
	if c == nil {
		return
	}
	common.SetContextKey(c, constant.ContextKeyAntiPoisonStreamMode, StreamModeForConfig(cfg))
}

func RecordOpaqueResult(c *gin.Context, result OpaqueScanResult) {
	if c == nil {
		return
	}
	common.SetContextKey(c, constant.ContextKeyAntiPoisonOpaqueScore, result.Score)
	common.SetContextKey(c, constant.ContextKeyAntiPoisonOpaqueHits, result.Signals)
	if result.Action == OpaqueActionBlock {
		RecordRisk(c, RiskHard, "opaque_payload", "block")
		return
	}
	if result.Action == OpaqueActionRetry {
		RecordRisk(c, RiskSuspicious, "opaque_payload", "retry")
	}
}

func RecordEnvelopeFailure(c *gin.Context, err error) {
	if c == nil || err == nil {
		return
	}
	RecordResult(c, constant.ContextKeyAntiPoisonEnvelopeResult, ResultFail)
	switch {
	case errors.Is(err, ErrEnvelopeMissing):
		RecordRisk(c, RiskSuspicious, "answer_envelope_missing", "retry")
	case errors.Is(err, ErrEnvelopeNonceMismatch):
		RecordRisk(c, RiskHard, "answer_envelope_nonce_mismatch", "block")
	case errors.Is(err, ErrEnvelopeOutsideText):
		RecordRisk(c, RiskHard, "answer_envelope_outside_text", "block")
	case errors.Is(err, ErrEnvelopeMalformed):
		RecordRisk(c, RiskHard, "answer_envelope_malformed", "block")
	default:
		RecordRisk(c, RiskHard, "answer_envelope", "block")
	}
}

func RecordProofFailure(c *gin.Context, err error) {
	if c == nil {
		return
	}
	RecordResult(c, constant.ContextKeyAntiPoisonProofResult, ResultFail)
	RecordRisk(c, RiskSuspicious, "response_proof", "retry")
}
