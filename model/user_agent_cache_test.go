package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUserAgentCacheTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&UserAgent{}))

	oldDB := DB
	oldLogDB := LOG_DB
	DB = db
	LOG_DB = db
	userAgentByID.Store(nil)
	userAgentGlobalByCat.Store(nil)

	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLogDB
		userAgentByID.Store(nil)
		userAgentGlobalByCat.Store(nil)
	})
}

func TestInitUserAgentCacheRefreshesImmediately(t *testing.T) {
	setupUserAgentCacheTestDB(t)

	require.NoError(t, DB.Create(&UserAgent{
		Name:          "old-openai",
		Value:         "old-agent",
		ModelCategory: ModelCategoryOpenAI,
		IsGlobal:      true,
		Enabled:       true,
		SortOrder:     10,
	}).Error)

	InitUserAgentCache()
	got, ok := GetCachedGlobalUserAgent(ModelCategoryOpenAI)
	require.True(t, ok)
	require.Equal(t, "old-agent", got)

	require.NoError(t, DB.Create(&UserAgent{
		Name:          "new-openai",
		Value:         "new-agent",
		ModelCategory: ModelCategoryOpenAI,
		IsGlobal:      true,
		Enabled:       true,
		SortOrder:     1,
	}).Error)

	InitUserAgentCache()
	got, ok = GetCachedGlobalUserAgent(ModelCategoryOpenAI)
	require.True(t, ok)
	require.Equal(t, "new-agent", got)
}
