package service

import (
	"fmt"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

func TruncationFallbackEnabled() bool {
	return common.GetEnvOrDefaultBool("TRUNCATION_FALLBACK_ENABLED", false)
}

func ShouldTriggerTruncationFallback(c *gin.Context, finishReason string) bool {
	if !TruncationFallbackEnabled() || finishReason != constant.FinishReasonLength {
		return false
	}
	if common.GetContextKeyBool(c, constant.ContextKeyTruncationRetry) {
		return false
	}
	return true
}

func NewTruncationFallbackError(c *gin.Context, channelID int, modelName string) *types.NewAPIError {
	common.SetContextKey(c, constant.ContextKeyTruncationRetry, true)
	return types.NewOpenAIError(
		fmt.Errorf("upstream response truncated: channel=%d model=%s finish_reason=%s", channelID, modelName, constant.FinishReasonLength),
		types.ErrorCodeTruncatedResponse,
		http.StatusBadGateway,
	)
}
