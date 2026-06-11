package service

import (
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func ChannelSupportsOpenAIResponses(channel *model.Channel) bool {
	if channel == nil {
		return false
	}
	switch channel.Type {
	case constant.ChannelTypeOpenAI,
		constant.ChannelTypeAzure,
		constant.ChannelTypeAli,
		constant.ChannelTypeCodex,
		constant.ChannelCloudflare,
		constant.ChannelTypePerplexity,
		constant.ChannelTypeVolcEngine,
		constant.ChannelTypeXai:
		return true
	}
	return false
}
