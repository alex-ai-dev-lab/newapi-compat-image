package middleware

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseProviderRoutingPolicyDisabledByDefault(t *testing.T) {
	t.Setenv("PROVIDER_ROUTING_CONTROL_ENABLED", "false")

	policy := parseProviderRoutingPolicyFromJSON([]byte(`{"provider":{"only":["openai"]},"ignore":"mock"}`))

	require.Nil(t, policy)
}

func TestParseProviderRoutingPolicySupportsNestedAndTopLevel(t *testing.T) {
	t.Setenv("PROVIDER_ROUTING_CONTROL_ENABLED", "true")

	policy := parseProviderRoutingPolicyFromJSON([]byte(`{
		"provider": {
			"only": ["openai", "azure, gemini"],
			"order": "azure,openai"
		},
		"ignore": ["mock", "mock"]
	}`))

	require.NotNil(t, policy)
	require.Equal(t, []string{"openai", "azure", "gemini"}, policy.Only)
	require.Equal(t, []string{"mock"}, policy.Ignore)
	require.Equal(t, []string{"azure", "openai"}, policy.Order)
}

func TestParseFallbackModelsDisabledByDefault(t *testing.T) {
	t.Setenv("REQUEST_MODELS_FALLBACK_ENABLED", "false")

	models := parseFallbackModelsFromJSON([]byte(`{"model":"gpt-a","models":["gpt-b"]}`), "gpt-a")

	require.Nil(t, models)
}

func TestParseFallbackModelsDedupesAndCaps(t *testing.T) {
	t.Setenv("REQUEST_MODELS_FALLBACK_ENABLED", "true")
	t.Setenv("REQUEST_MODELS_FALLBACK_MAX", "3")

	models := parseFallbackModelsFromJSON([]byte(`{"model":"gpt-a","models":["gpt-b","gpt-a","gpt-c","gpt-d"]}`), "gpt-a")

	require.Equal(t, []string{"gpt-a", "gpt-b", "gpt-c"}, models)
}
