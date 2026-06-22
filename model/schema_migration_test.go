package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRunSchemaMigrationOnceSkipsAfterSuccess(t *testing.T) {
	oldDB := DB
	oldUsingSQLite := common.UsingSQLite
	t.Cleanup(func() {
		DB = oldDB
		common.UsingSQLite = oldUsingSQLite
	})

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	common.UsingSQLite = true

	runs := 0
	migrate := func() error {
		runs++
		return nil
	}

	require.NoError(t, runSchemaMigrationOnce("test:once:v1", migrate))
	require.NoError(t, runSchemaMigrationOnce("test:once:v1", migrate))
	require.Equal(t, 1, runs)
	require.True(t, DB.Migrator().HasTable(&SchemaMigration{}))
}
