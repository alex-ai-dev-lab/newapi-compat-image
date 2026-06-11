package controller

import (
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestConvertModelsDevToRatioDataUsesOnlyOfficialProviders(t *testing.T) {
	payload := `{
		"openai": {
			"models": {
				"gpt-5.5": {
					"cost": {"input": 5, "output": 30, "cache_read": 0.5}
				}
			}
		},
		"poe": {
			"models": {
				"openai/gpt-5.5": {
					"cost": {"input": 4.5455, "output": 27.2727, "cache_read": 0.4545}
				}
			}
		},
		"openrouter": {
			"models": {
				"openai/gpt-5.5": {
					"cost": {"input": 5, "output": 30, "cache_read": 0.5}
				}
			}
		},
		"anthropic": {
			"models": {
				"claude-opus-4-6": {
					"cost": {"input": 5, "output": 25, "cache_read": 0.5}
				}
			}
		},
		"alibaba-cn": {
			"models": {
				"qwen3-max": {
					"cost": {"input": 1.2, "output": 6, "cache_read": 0.12}
				},
				"siliconflow/deepseek-v3.2": {
					"cost": {"input": 0.1, "output": 0.2, "cache_read": 0.01}
				},
				"MiniMax/MiniMax-M2.7": {
					"cost": {"input": 0.2, "output": 0.4, "cache_read": 0.02}
				}
			}
		},
		"vercel": {
			"models": {
				"anthropic/claude-opus-4-6": {
					"cost": {"input": 4, "output": 20, "cache_read": 0.4}
				}
			}
		}
	}`

	converted, err := convertModelsDevToRatioData(strings.NewReader(payload))
	require.NoError(t, err)

	modelRatios := converted["model_ratio"].(map[string]any)
	completionRatios := converted["completion_ratio"].(map[string]any)
	cacheRatios := converted["cache_ratio"].(map[string]any)

	require.Equal(t, 2.5, modelRatios["gpt-5.5"])
	require.Equal(t, 6.0, completionRatios["gpt-5.5"])
	require.Equal(t, 0.1, cacheRatios["gpt-5.5"])
	require.NotContains(t, modelRatios, "openai/gpt-5.5")

	require.Equal(t, 2.5, modelRatios["claude-opus-4-6"])
	require.Equal(t, 5.0, completionRatios["claude-opus-4-6"])
	require.Equal(t, 0.1, cacheRatios["claude-opus-4-6"])
	require.NotContains(t, modelRatios, "anthropic/claude-opus-4-6")

	require.Equal(t, 0.6, modelRatios["qwen3-max"])
	require.Equal(t, 5.0, completionRatios["qwen3-max"])
	require.Equal(t, 0.1, cacheRatios["qwen3-max"])
	require.NotContains(t, modelRatios, "siliconflow/deepseek-v3.2")
	require.NotContains(t, modelRatios, "MiniMax/MiniMax-M2.7")
}

func TestMergeOfficialRatioFieldAddsMissingOnly(t *testing.T) {
	current := map[string]float64{
		"grok-4.3-high":    99,
		"claude-opus-4-7":  2.5,
		"manual-local-one": 12,
	}
	official := map[string]any{
		"grok-4.3-high":    1.5,
		"claude-opus-4-7":  7.5,
		"claude-opus-4-8":  2.5,
		"bad-price-format": "skip-me",
	}

	merged, added := mergeOfficialRatioField(current, official)

	require.Equal(t, 1, added)
	require.Equal(t, 99.0, merged["grok-4.3-high"])
	require.Equal(t, 2.5, merged["claude-opus-4-7"])
	require.Equal(t, 12.0, merged["manual-local-one"])
	require.Equal(t, 2.5, merged["claude-opus-4-8"])
	require.NotContains(t, merged, "bad-price-format")
}

func TestNextOfficialSyncTimeUsesSevenAMLocalTime(t *testing.T) {
	location := time.FixedZone("Asia/Taipei", 8*60*60)

	beforeSeven := time.Date(2026, 6, 8, 6, 30, 0, 0, location)
	require.Equal(
		t,
		time.Date(2026, 6, 8, 7, 0, 0, 0, location),
		nextOfficialSyncTime(beforeSeven),
	)

	afterSeven := time.Date(2026, 6, 8, 7, 1, 0, 0, location)
	require.Equal(
		t,
		time.Date(2026, 6, 9, 7, 0, 0, 0, location),
		nextOfficialSyncTime(afterSeven),
	)
}
