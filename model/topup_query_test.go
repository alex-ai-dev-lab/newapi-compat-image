package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func insertTopUpForQueryTest(t *testing.T, tradeNo string, userID int, createTime int64) {
	t.Helper()
	require.NoError(t, (&TopUp{
		UserId:          userID,
		Amount:          100,
		Money:           1,
		TradeNo:         tradeNo,
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		CreateTime:      createTime,
		Status:          common.TopUpStatusSuccess,
	}).Insert())
}

func TestGetAllTopUpsFiltersByTimeRange(t *testing.T) {
	truncateTables(t)
	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}

	insertTopUpForQueryTest(t, "old", 1, 100)
	insertTopUpForQueryTest(t, "in-range", 1, 200)
	insertTopUpForQueryTest(t, "new", 1, 300)

	topups, total, err := GetAllTopUps(pageInfo, TopUpQueryOptions{StartTime: 150, EndTime: 250})

	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, topups, 1)
	require.Equal(t, "in-range", topups[0].TradeNo)
}

func TestSearchUserTopUpsFiltersByTimeRange(t *testing.T) {
	truncateTables(t)
	pageInfo := &common.PageInfo{Page: 1, PageSize: 10}

	insertTopUpForQueryTest(t, "match-old", 2, 100)
	insertTopUpForQueryTest(t, "match-new", 2, 300)
	insertTopUpForQueryTest(t, "match-other-user", 3, 300)

	topups, total, err := SearchUserTopUps(2, "match-new", pageInfo, TopUpQueryOptions{StartTime: 250})

	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	require.Len(t, topups, 1)
	require.Equal(t, "match-new", topups[0].TradeNo)
}
