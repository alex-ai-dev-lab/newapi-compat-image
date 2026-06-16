package channel

import (
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestApplyHeaderRulesActionsAndCategories(t *testing.T) {
	req := &http.Request{Header: http.Header{}, URL: mustParseURL("https://example.com/v1/responses")}
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAIResponses}
	setting := model.HeaderRuleSetting{
		Enabled:            true,
		ApplyToChannelTest: true,
		Groups: []model.HeaderRuleGroup{
			{
				Category: model.HeaderRuleCategoryAll,
				Enabled:  true,
				Rules: []model.HeaderRule{
					{Enabled: true, Name: "X-All", Action: model.HeaderActionSetFixed, Value: "all"},
				},
			},
			{
				Category: "codex",
				Enabled:  true,
				Rules: []model.HeaderRule{
					{Enabled: true, Name: "Originator", Action: model.HeaderActionSetIfAbsent, Value: "codex_cli_rs"},
				},
			},
		},
	}

	applyHeaderRulesWithSetting(req, info, setting)
	require.Equal(t, "all", req.Header.Get("X-All"))
	require.Equal(t, "codex_cli_rs", req.Header.Get("Originator"))
}

func TestApplyHeaderRulesSkipsChannelTestWhenDisabled(t *testing.T) {
	req := &http.Request{Header: http.Header{}, URL: mustParseURL("https://example.com/v1/responses")}
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAIResponses, IsChannelTest: true}
	setting := model.HeaderRuleSetting{
		Enabled:            true,
		ApplyToChannelTest: false,
		Groups:             []model.HeaderRuleGroup{{Category: "codex", Enabled: true, Rules: []model.HeaderRule{{Enabled: true, Name: "Originator", Action: model.HeaderActionSetFixed, Value: "codex_cli_rs"}}}},
	}

	applyHeaderRulesWithSetting(req, info, setting)
	require.Empty(t, req.Header.Get("Originator"))
}

func TestApplyHeaderRulesAppliesChannelTestWhenEnabled(t *testing.T) {
	req := &http.Request{Header: http.Header{}, URL: mustParseURL("https://example.com/v1/responses")}
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAIResponses, IsChannelTest: true}
	setting := model.HeaderRuleSetting{
		Enabled:            true,
		ApplyToChannelTest: true,
		Groups: []model.HeaderRuleGroup{
			{
				Category: "codex",
				Enabled:  true,
				Rules: []model.HeaderRule{
					{Enabled: true, Name: "Originator", Action: model.HeaderActionSetFixed, Value: "codex_cli_rs"},
				},
			},
		},
	}

	applyHeaderRulesWithSetting(req, info, setting)
	require.Equal(t, "codex_cli_rs", req.Header.Get("Originator"))
}

func TestResolveHeaderRuleCategoryOpenAIChat(t *testing.T) {
	req := &http.Request{Header: http.Header{}, URL: mustParseURL("https://example.com/v1/chat/completions")}
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}

	require.Equal(t, model.ModelCategoryOpenAI, resolveHeaderRuleCategory(info, req))
}
