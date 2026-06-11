// Package sqlite provides SQLite tuning for production workloads.
package sqlite

import (
	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// TunePragmas applies production-ready SQLite settings.
// Call this after opening a SQLite database but before use.
func TunePragmas(db *gorm.DB) error {
	if db == nil {
		return nil
	}

	sqlDB, err := db.DB()
	if err != nil {
		return err
	}

	// Connection pool: conservative defaults for SQLite to avoid lock contention
	sqlDB.SetMaxIdleConns(common.GetEnvOrDefault("SQLITE_MAX_IDLE_CONNS", 1))
	sqlDB.SetMaxOpenConns(common.GetEnvOrDefault("SQLITE_MAX_OPEN_CONNS", 1))

	// WAL mode for better concurrency (readers don't block writers)
	_ = db.Exec("PRAGMA journal_mode=WAL").Error

	// synchronous=NORMAL is safe with WAL and faster than FULL
	_ = db.Exec("PRAGMA synchronous=NORMAL").Error

	// busy_timeout: wait up to 120s for lock instead of immediate SQLITE_BUSY
	_ = db.Exec("PRAGMA busy_timeout=120000").Error

	return nil
}
