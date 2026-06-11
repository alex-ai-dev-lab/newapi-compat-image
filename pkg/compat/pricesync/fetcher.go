// Package pricesync provides the entry point for official model price sync.
// The actual fetching/syncing logic lives in controller/official_price_sync.go
// for now; this package centralizes the startup hook for cleanliness.
package pricesync

import (
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
)

// Start launches the official price sync task only when explicitly enabled.
//
// Ken's current production choice is manual one-shot sync, not a default
// background job. Set OFFICIAL_PRICE_SYNC_ENABLED=true to restore auto sync.
func Start() {
	if !autoSyncEnabled() {
		common.SysLog("official price sync auto task disabled; use /api/pricing/official-sync/trigger for manual sync")
		return
	}
	controller.StartOfficialPriceSyncTask()
}

func autoSyncEnabled() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("OFFICIAL_PRICE_SYNC_ENABLED")))
	return value == "1" || value == "true" || value == "yes" || value == "on"
}
