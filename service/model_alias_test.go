package service

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResolveLatestModelAliasUsesConfiguredMapWhenEnabled(t *testing.T) {
	oldEnabled := os.Getenv("MODEL_LATEST_ALIAS_ENABLED")
	oldMap := os.Getenv("MODEL_LATEST_ALIAS_MAP")
	t.Cleanup(func() {
		_ = os.Setenv("MODEL_LATEST_ALIAS_ENABLED", oldEnabled)
		_ = os.Setenv("MODEL_LATEST_ALIAS_MAP", oldMap)
		ResetLatestModelAliasCacheForTest()
	})

	require.NoError(t, os.Setenv("MODEL_LATEST_ALIAS_ENABLED", "true"))
	require.NoError(t, os.Setenv("MODEL_LATEST_ALIAS_MAP", `{"gpt-5-latest":"gpt-5.4","CLAUDE-LATEST":"claude-sonnet-4-5-20250929"}`))
	ResetLatestModelAliasCacheForTest()

	require.Equal(t, "gpt-5.4", ResolveLatestModelAlias("gpt-5-latest"))
	require.Equal(t, "claude-sonnet-4-5-20250929", ResolveLatestModelAlias("claude-latest"))
	require.Equal(t, "gpt-4o", ResolveLatestModelAlias("gpt-4o"))
}

func TestResolveLatestModelAliasDisabledByDefault(t *testing.T) {
	oldEnabled := os.Getenv("MODEL_LATEST_ALIAS_ENABLED")
	oldMap := os.Getenv("MODEL_LATEST_ALIAS_MAP")
	t.Cleanup(func() {
		_ = os.Setenv("MODEL_LATEST_ALIAS_ENABLED", oldEnabled)
		_ = os.Setenv("MODEL_LATEST_ALIAS_MAP", oldMap)
		ResetLatestModelAliasCacheForTest()
	})

	require.NoError(t, os.Setenv("MODEL_LATEST_ALIAS_ENABLED", "false"))
	require.NoError(t, os.Setenv("MODEL_LATEST_ALIAS_MAP", `{"gpt-5-latest":"gpt-5.4"}`))
	ResetLatestModelAliasCacheForTest()

	require.Equal(t, "gpt-5-latest", ResolveLatestModelAlias("gpt-5-latest"))
}
