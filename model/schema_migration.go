package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var errSchemaMigrationNotApplied = errors.New("schema migration not applied")

type SchemaMigration struct {
	Key       string `gorm:"primaryKey;size:191;column:migration_key"`
	AppliedAt int64  `gorm:"not null"`
}

func ensureSchemaMigrationsTable() error {
	return DB.AutoMigrate(&SchemaMigration{})
}

func runSchemaMigrationOnce(key string, migrate func() error) error {
	if key == "" {
		return errors.New("schema migration key is empty")
	}
	if err := ensureSchemaMigrationsTable(); err != nil {
		return err
	}

	var existing SchemaMigration
	err := DB.Where("migration_key = ?", key).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if err := migrate(); errors.Is(err, errSchemaMigrationNotApplied) {
		return nil
	} else if err != nil {
		return err
	}

	record := SchemaMigration{
		Key:       key,
		AppliedAt: time.Now().Unix(),
	}
	if err := DB.Create(&record).Error; err != nil {
		return err
	}
	common.SysLog("schema migration applied: " + key)
	return nil
}
