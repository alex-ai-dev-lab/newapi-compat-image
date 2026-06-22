package toolschema

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/require"
)

func TestCleanChatToolsRemovesUnsupportedFieldsRecursively(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "lookup",
					Parameters: map[string]any{
						"type":                 "object",
						"additionalProperties": false,
						"$schema":              "https://json-schema.org/draft/2020-12/schema",
						"properties": map[string]any{
							"id": map[string]any{
								"type":    "string",
								"pattern": "^[a-z]+$",
								"enum":    []any{"abc"},
							},
							"items": map[string]any{
								"type":  "array",
								"items": map[string]any{"type": "string", "format": "uuid"},
							},
						},
						"required": []any{"id"},
					},
				},
			},
		},
	}

	require.True(t, CleanChatTools(req))

	params := req.Tools[0].Function.Parameters.(map[string]any)
	require.Equal(t, "object", params["type"])
	require.Contains(t, params, "properties")
	require.Contains(t, params, "required")
	require.NotContains(t, params, "additionalProperties")
	require.NotContains(t, params, "$schema")

	id := params["properties"].(map[string]any)["id"].(map[string]any)
	require.Equal(t, "string", id["type"])
	require.Contains(t, id, "enum")
	require.NotContains(t, id, "pattern")

	items := params["properties"].(map[string]any)["items"].(map[string]any)["items"].(map[string]any)
	require.Equal(t, "string", items["type"])
	require.NotContains(t, items, "format")
}

func TestCleanResponsesToolsRewritesRawTools(t *testing.T) {
	raw := []map[string]any{
		{
			"type": "function",
			"name": "lookup",
			"parameters": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
			},
		},
	}
	data, err := json.Marshal(raw)
	require.NoError(t, err)
	req := &dto.OpenAIResponsesRequest{Tools: data}

	require.NoError(t, CleanResponsesTools(req))

	var tools []map[string]any
	require.NoError(t, json.Unmarshal(req.Tools, &tools))
	params := tools[0]["parameters"].(map[string]any)
	require.Equal(t, "object", params["type"])
	require.NotContains(t, params, "additionalProperties")
}

func TestShouldCleanChannel(t *testing.T) {
	require.True(t, ShouldCleanChannel(constant.ChannelTypeGemini, "", ""))
	require.True(t, ShouldCleanChannel(constant.ChannelTypeVertexAi, "", ""))
	require.True(t, ShouldCleanChannel(constant.ChannelTypeOpenAI, "Antigravity Test", ""))
	require.False(t, ShouldCleanChannel(constant.ChannelTypeOpenAI, "OpenAI", "https://api.openai.com"))
}
