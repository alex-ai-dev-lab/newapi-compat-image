package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelModelStatusTestDB(t *testing.T) {
	t.Helper()
	oldDB := DB
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	t.Cleanup(func() {
		DB = oldDB
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		ReloadChannelModelStatusCache()
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ChannelModelStatus{}))
	DB = db
	common.MemoryCacheEnabled = true
	ReloadChannelModelStatusCache()
}

func TestChannelModelFailureThresholdAndCooldown(t *testing.T) {
	setupChannelModelStatusTestDB(t)

	update := ChannelModelFailureUpdate{
		ChannelId:           71,
		Group:               "default",
		ModelName:           "claude-opus-4-6",
		LastError:           "status_code=500, not implemented",
		LastStatusCode:      500,
		AutoDisableEligible: true,
		FailureThreshold:    3,
		CooldownSeconds:     600,
	}

	require.NoError(t, UpsertChannelModelFailure(update))
	require.False(t, IsChannelModelDisabledForGroup(71, "default", "claude-opus-4-6"))
	require.NoError(t, UpsertChannelModelFailure(update))
	require.False(t, IsChannelModelDisabledForGroup(71, "default", "claude-opus-4-6"))
	require.NoError(t, UpsertChannelModelFailure(update))
	require.True(t, IsChannelModelDisabledForGroup(71, "default", "claude-opus-4-6"))

	status, err := GetChannelModelStatus(71, "default", "claude-opus-4-6")
	require.NoError(t, err)
	require.Equal(t, 3, status.FailureCount)
	require.Equal(t, common.ChannelStatusAutoDisabled, status.Status)
	require.Greater(t, status.DisabledUntil, common.GetTimestamp())

	status.DisabledUntil = common.GetTimestamp() - 1
	require.NoError(t, DB.Save(status).Error)
	cacheStoreChannelModelStatus(*status)
	require.False(t, IsChannelModelDisabledForGroup(71, "default", "claude-opus-4-6"))
}

func TestChannelModelSuccessRestoresAutoDisabledStatus(t *testing.T) {
	setupChannelModelStatusTestDB(t)

	require.NoError(t, UpsertChannelModelFailure(ChannelModelFailureUpdate{
		ChannelId:           89,
		Group:               "default",
		ModelName:           "claude-opus-4-6",
		LastError:           "status_code=500, not implemented",
		LastStatusCode:      500,
		AutoDisableEligible: true,
		FailureThreshold:    1,
		CooldownSeconds:     600,
	}))
	require.True(t, IsChannelModelDisabledForGroup(89, "default", "claude-opus-4-6"))

	require.NoError(t, RecordChannelModelSuccess(ChannelModelSuccessUpdate{
		ChannelId: 89,
		Group:     "default",
		ModelName: "claude-opus-4-6",
	}))

	status, err := GetChannelModelStatus(89, "default", "claude-opus-4-6")
	require.NoError(t, err)
	require.Equal(t, common.ChannelStatusEnabled, status.Status)
	require.Equal(t, 0, status.FailureCount)
}

func TestChannelModelFailureDoesNotOverrideManualDisable(t *testing.T) {
	setupChannelModelStatusTestDB(t)

	require.NoError(t, UpdateChannelModelStatus(106, "default", "claude-opus-4-6", common.ChannelStatusManuallyDisabled, "manual stop", "manual"))
	require.NoError(t, UpsertChannelModelFailure(ChannelModelFailureUpdate{
		ChannelId:        106,
		Group:            "default",
		ModelName:        "claude-opus-4-6",
		LastError:        "status_code=500, not implemented",
		LastStatusCode:   500,
		ForceDisabled:    true,
		FailureThreshold: 1,
		CooldownSeconds:  600,
	}))

	status, err := GetChannelModelStatus(106, "default", "claude-opus-4-6")
	require.NoError(t, err)
	require.Equal(t, common.ChannelStatusManuallyDisabled, status.Status)
	require.Equal(t, "manual", status.LastDisabledBy)

	require.NoError(t, RecordChannelModelSuccess(ChannelModelSuccessUpdate{
		ChannelId: 106,
		Group:     "default",
		ModelName: "claude-opus-4-6",
	}))
	status, err = GetChannelModelStatus(106, "default", "claude-opus-4-6")
	require.NoError(t, err)
	require.Equal(t, common.ChannelStatusManuallyDisabled, status.Status)
}

func TestChannelModelStatusViewMarksExpiredAutoDisableAsProbing(t *testing.T) {
	setupChannelModelStatusTestDB(t)

	now := common.GetTimestamp()
	require.NoError(t, DB.Create(&ChannelModelStatus{
		ChannelId:     71,
		Group:         "default",
		ModelName:     "claude-opus-4-6",
		Status:        common.ChannelStatusAutoDisabled,
		DisabledUntil: now - 1,
		CreatedTime:   now,
		UpdatedTime:   now,
	}).Error)

	views, err := ListChannelModelStatuses(&Channel{
		Id:     71,
		Group:  "default",
		Models: "claude-opus-4-6",
	})
	require.NoError(t, err)
	require.Len(t, views, 1)
	require.True(t, views[0].Probing)
	require.False(t, IsChannelModelDisabledForGroup(71, "default", "claude-opus-4-6"))
}
