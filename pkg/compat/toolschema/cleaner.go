package toolschema

import (
	"encoding/json"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/compat"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
)

type Hook struct {
	compat.NoOpRelayHook
}

func New() *Hook {
	return &Hook{}
}

func (h *Hook) Name() string {
	return "toolschema"
}

func (h *Hook) BeforeChannelCall(c *gin.Context, info *relaycommon.RelayInfo, ch *model.Channel, p *service.RetryParam) *types.NewAPIError {
	if info == nil || ch == nil || !ShouldCleanChannel(ch.Type, ch.Name, channelBaseURL(ch)) {
		return nil
	}
	switch req := info.Request.(type) {
	case *dto.GeneralOpenAIRequest:
		CleanChatTools(req)
	case *dto.OpenAIResponsesRequest:
		if err := CleanResponsesTools(req); err != nil {
			return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}
	return nil
}

func channelBaseURL(ch *model.Channel) string {
	if ch == nil || ch.BaseURL == nil {
		return ""
	}
	return *ch.BaseURL
}

func ShouldCleanChannel(channelType int, channelName, baseURL string) bool {
	if channelType == constant.ChannelTypeGemini || channelType == constant.ChannelTypeVertexAi {
		return true
	}
	name := strings.ToLower(channelName)
	base := strings.ToLower(baseURL)
	return strings.Contains(name, "antigravity") || strings.Contains(base, "antigravity")
}

func CleanChatTools(req *dto.GeneralOpenAIRequest) bool {
	if req == nil || len(req.Tools) == 0 {
		return false
	}
	changed := false
	for i := range req.Tools {
		cleaned, ok, toolChanged := cleanAny(req.Tools[i].Function.Parameters)
		if toolChanged {
			changed = true
		}
		if ok {
			req.Tools[i].Function.Parameters = cleaned
		}
	}
	return changed
}

func CleanResponsesTools(req *dto.OpenAIResponsesRequest) error {
	if req == nil || len(req.Tools) == 0 {
		return nil
	}
	var tools []any
	if err := common.Unmarshal(req.Tools, &tools); err != nil {
		return err
	}
	changed := false
	for i := range tools {
		cleaned, ok, toolChanged := cleanAny(tools[i])
		if toolChanged {
			changed = true
		}
		if ok {
			tools[i] = cleaned
		}
	}
	if !changed {
		return nil
	}
	data, err := common.Marshal(tools)
	if err != nil {
		return err
	}
	req.Tools = json.RawMessage(data)
	return nil
}

func cleanAny(value any) (any, bool, bool) {
	switch v := value.(type) {
	case nil:
		return nil, false, false
	case map[string]any:
		changed := cleanSchemaMap(v)
		return v, true, changed
	case []any:
		changed := false
		for i := range v {
			cleaned, ok, itemChanged := cleanAny(v[i])
			if itemChanged {
				changed = true
			}
			if ok {
				v[i] = cleaned
			}
		}
		return v, true, changed
	case json.RawMessage:
		var decoded any
		if err := json.Unmarshal(v, &decoded); err != nil {
			return value, false, false
		}
		cleaned, _, changed := cleanAny(decoded)
		return cleaned, true, changed
	default:
		return value, false, false
	}
}

func cleanSchemaMap(m map[string]any) bool {
	changed := false
	for key := range unsupportedSchemaFields {
		if _, ok := m[key]; ok {
			delete(m, key)
			changed = true
		}
	}
	for key, value := range m {
		cleaned, ok, childChanged := cleanAny(value)
		if childChanged {
			changed = true
		}
		if ok {
			m[key] = cleaned
		}
	}
	return changed
}

var unsupportedSchemaFields = map[string]struct{}{
	"$schema":              {},
	"additionalProperties": {},
	"allOf":                {},
	"anyOf":                {},
	"default":              {},
	"dependentRequired":    {},
	"dependentSchemas":     {},
	"else":                 {},
	"examples":             {},
	"format":               {},
	"if":                   {},
	"maxProperties":        {},
	"minProperties":        {},
	"not":                  {},
	"oneOf":                {},
	"pattern":              {},
	"patternProperties":    {},
	"propertyNames":        {},
	"then":                 {},
	"unevaluatedProperties": {},
}
