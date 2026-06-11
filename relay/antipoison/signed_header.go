package antipoison

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

const (
	SignedHeaderNonce     = "X-NewAPI-Guard-Nonce"
	SignedHeaderTimestamp = "X-NewAPI-Guard-Timestamp"
	SignedHeaderSignature = "X-NewAPI-Guard-Signature"
)

// AuditSignedHeaders validates optional client proof headers for internal
// auditing only. It never exposes proof headers downstream and never blocks
// model traffic, because normal clients such as Codex and Claude cannot be
// expected to participate in this gateway-local contract.
func AuditSignedHeaders(c *gin.Context, info *relaycommon.RelayInfo) {
	setting := operation_setting.GetAntiPoisonSetting()
	if c == nil || !setting.Enabled || !setting.SignedHeaderAuditEnabled {
		return
	}
	secret := strings.TrimSpace(setting.SignedHeaderAuditSecret)
	if secret == "" {
		common.SysLog("anti-poison signed-header audit skipped: empty secret")
		return
	}
	nonce := strings.TrimSpace(c.GetHeader(SignedHeaderNonce))
	ts := strings.TrimSpace(c.GetHeader(SignedHeaderTimestamp))
	sig := strings.TrimSpace(c.GetHeader(SignedHeaderSignature))
	if nonce == "" && ts == "" && sig == "" {
		return
	}
	if nonce == "" || ts == "" || sig == "" {
		common.SysLog("anti-poison signed-header audit failed: missing header")
		return
	}
	requestID := ""
	if info != nil {
		requestID = info.RequestId
	}
	payload := strings.Join([]string{
		c.Request.Method,
		c.Request.URL.Path,
		ts,
		nonce,
		requestID,
	}, "\n")
	expected := signPayload(secret, payload)
	if !hmac.Equal([]byte(strings.ToLower(sig)), []byte(expected)) {
		common.SysLog("anti-poison signed-header audit failed: signature mismatch")
		return
	}
	common.SysLog(fmt.Sprintf("anti-poison signed-header audit ok: nonce=%s", nonce))
}

func signPayload(secret string, payload string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}
