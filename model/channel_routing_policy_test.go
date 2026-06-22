package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

type testChannelRoutingPolicy struct {
	ranks map[int]int
}

func (p testChannelRoutingPolicy) Empty() bool {
	return false
}

func (p testChannelRoutingPolicy) Matches(channel *Channel) bool {
	return channel != nil
}

func (p testChannelRoutingPolicy) OrderRank(channel *Channel) int {
	if channel == nil {
		return 99
	}
	if rank, ok := p.ranks[channel.Id]; ok {
		return rank
	}
	return 99
}

func TestKeepBestProviderRoutingOrderRank(t *testing.T) {
	channels := []*Channel{{Id: 1}, {Id: 2}, {Id: 3}}
	policy := testChannelRoutingPolicy{ranks: map[int]int{1: 2, 2: 0, 3: 0}}

	filtered := keepBestProviderRoutingOrderRank(channels, policy)

	require.Equal(t, []*Channel{{Id: 2}, {Id: 3}}, filtered)
}
