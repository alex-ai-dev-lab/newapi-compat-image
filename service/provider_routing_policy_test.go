package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
)

func TestProviderRoutingPolicyMatchesSelectors(t *testing.T) {
	tag := "paid"
	baseURL := "https://api.example.com/v1/"
	channel := &model.Channel{
		Id:      42,
		Type:    constant.ChannelTypeOpenAI,
		Name:    "primary-openai",
		BaseURL: &baseURL,
		Tag:     &tag,
	}

	for _, selector := range []string{
		"openai",
		"primary-openai",
		"paid",
		"https://api.example.com/v1",
		"api.example.com",
		"#42",
		"id:42",
	} {
		policy := &ProviderRoutingPolicy{Only: []string{selector}}
		require.True(t, policy.Matches(channel), selector)
	}
}

func TestProviderRoutingPolicyOnlyAndIgnore(t *testing.T) {
	channel := &model.Channel{Id: 58, Type: constant.ChannelTypeMock, Name: "mock-test"}

	require.True(t, (&ProviderRoutingPolicy{Only: []string{"mock"}}).Matches(channel))
	require.False(t, (&ProviderRoutingPolicy{Only: []string{"openai"}}).Matches(channel))
	require.False(t, (&ProviderRoutingPolicy{Ignore: []string{"mock"}}).Matches(channel))
}

func TestProviderRoutingPolicyOrderRank(t *testing.T) {
	openAI := &model.Channel{Type: constant.ChannelTypeOpenAI}
	azure := &model.Channel{Type: constant.ChannelTypeAzure}
	policy := &ProviderRoutingPolicy{Order: []string{"azure", "openai"}}

	require.Equal(t, 0, policy.OrderRank(azure))
	require.Equal(t, 1, policy.OrderRank(openAI))
}
