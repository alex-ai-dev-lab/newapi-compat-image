package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestShouldTriggerTruncationFallbackDisabledByDefault(t *testing.T) {
	t.Setenv("TRUNCATION_FALLBACK_ENABLED", "false")
	gin.SetMode(gin.TestMode)
	ctx := &gin.Context{}

	require.False(t, ShouldTriggerTruncationFallback(ctx, constant.FinishReasonLength))
}

func TestShouldTriggerTruncationFallbackOnlyOnce(t *testing.T) {
	t.Setenv("TRUNCATION_FALLBACK_ENABLED", "true")
	gin.SetMode(gin.TestMode)
	ctx := &gin.Context{}

	require.True(t, ShouldTriggerTruncationFallback(ctx, constant.FinishReasonLength))
	err := NewTruncationFallbackError(ctx, 1, "gpt-test")
	require.NotNil(t, err)
	require.False(t, ShouldTriggerTruncationFallback(ctx, constant.FinishReasonLength))
	require.False(t, ShouldTriggerTruncationFallback(ctx, constant.FinishReasonStop))
}
