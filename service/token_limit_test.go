package service

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

func TestTokenRPMMemoryLimit(t *testing.T) {
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
		ResetTokenLimitForTest()
	}()

	ResetTokenLimitForTest()
	require.True(t, CheckAndRecordTokenRPM(7, 2))
	require.True(t, CheckAndRecordTokenRPM(7, 2))
	require.False(t, CheckAndRecordTokenRPM(7, 2))
	require.True(t, CheckAndRecordTokenRPM(8, 2))
	require.True(t, CheckAndRecordTokenRPM(7, 0))
}

func TestTokenTPMMemoryLimitDoesNotConsumeRejectedAttempt(t *testing.T) {
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
		ResetTokenLimitForTest()
	}()

	ResetTokenLimitForTest()
	require.True(t, CheckAndRecordTokenTPM(7, 10, 6))
	require.False(t, CheckAndRecordTokenTPM(7, 10, 5))
	require.True(t, CheckAndRecordTokenTPM(7, 10, 4))
	require.False(t, CheckAndRecordTokenTPM(7, 10, 11))
}

func TestTokenConcurrencyMemoryLimit(t *testing.T) {
	oldRedisEnabled := common.RedisEnabled
	oldRDB := common.RDB
	common.RedisEnabled = false
	common.RDB = nil
	defer func() {
		common.RedisEnabled = oldRedisEnabled
		common.RDB = oldRDB
		ResetTokenLimitForTest()
	}()

	ResetTokenLimitForTest()
	require.True(t, TryAcquireTokenConcurrency(7, 1))
	require.False(t, TryAcquireTokenConcurrency(7, 1))
	ReleaseTokenConcurrency(7, 1)
	require.True(t, TryAcquireTokenConcurrency(7, 1))
	ReleaseTokenConcurrency(7, 1)
	require.True(t, TryAcquireTokenConcurrency(7, 0))
}
