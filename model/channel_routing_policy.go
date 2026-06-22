package model

import "sort"

type ChannelRoutingPolicy interface {
	Empty() bool
	Matches(channel *Channel) bool
	OrderRank(channel *Channel) int
}

func sortChannelsByProviderRoutingOrder(channels []*Channel, policy ChannelRoutingPolicy) {
	if policy == nil || policy.Empty() || len(channels) < 2 {
		return
	}
	sort.SliceStable(channels, func(i, j int) bool {
		return policy.OrderRank(channels[i]) < policy.OrderRank(channels[j])
	})
}

func keepBestProviderRoutingOrderRank(channels []*Channel, policy ChannelRoutingPolicy) []*Channel {
	if policy == nil || policy.Empty() || len(channels) < 2 {
		return channels
	}
	bestRank := policy.OrderRank(channels[0])
	for _, channel := range channels[1:] {
		if rank := policy.OrderRank(channel); rank < bestRank {
			bestRank = rank
		}
	}
	filtered := channels[:0]
	for _, channel := range channels {
		if policy.OrderRank(channel) == bestRank {
			filtered = append(filtered, channel)
		}
	}
	return filtered
}
