package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestChannelMatchesRetryRequirementsRequiresOpenAIResponsesSupport(t *testing.T) {
	param := &RetryParam{RequireOpenAIResponsesSupport: true}

	require.False(t, channelMatchesRetryRequirements(param, &model.Channel{
		Type: constant.ChannelTypeAnthropic,
	}))
	require.True(t, channelMatchesRetryRequirements(param, &model.Channel{
		Type: constant.ChannelTypeOpenAI,
	}))
	require.True(t, channelMatchesRetryRequirements(param, &model.Channel{
		Type: constant.ChannelTypeCodex,
	}))
	require.False(t, channelMatchesRetryRequirements(param, &model.Channel{
		Type:    constant.ChannelTypeAnthropic,
		BaseURL: common.GetPointer("https://example.test/codex"),
	}))
}
