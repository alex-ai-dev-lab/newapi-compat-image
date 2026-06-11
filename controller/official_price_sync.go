package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

// Official model-price sync.
//
// Requirement: keep all model prices aligned with official pricing, refreshed
// daily, and stop syncing prices from arbitrary peer channels. models.dev is an
// open, community-maintained aggregate of official provider pricing
// (OpenAI / Anthropic / Google / etc.), so it is used as the single official
// source here.
//
// The sync is additive: official-source prices are imported only when a model
// is missing locally. Existing local prices are preserved so hand-maintained
// special models and manual overrides are not overwritten by the upstream
// source.

const (
	officialPriceSourceURL  = "https://models.dev/api.json"
	officialSyncInterval    = 24 * time.Hour
	officialSyncTimeOfDay   = "07:00"
	officialSyncHTTPTimeout = 30 * time.Second
)

var (
	officialSyncOnce  sync.Once
	officialSyncMu    sync.Mutex
	officialSyncState = struct {
		LastRunUnix   int64
		LastOK        bool
		LastError     string
		LastModelsNum int
	}{}
)

// fetchOfficialPricing downloads and converts models.dev pricing into ratio maps.
func fetchOfficialPricing() (map[string]any, error) {
	client := &http.Client{Timeout: officialSyncHTTPTimeout}
	req, err := http.NewRequest(http.MethodGet, officialPriceSourceURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "new-api-official-price-sync")

	// Simple retry with backoff (mirrors existing ratio_sync behavior).
	var resp *http.Response
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		resp, lastErr = client.Do(req)
		if lastErr == nil {
			break
		}
		time.Sleep(time.Duration(300*(1<<attempt)) * time.Millisecond)
	}
	if lastErr != nil {
		return nil, lastErr
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("official price source returned %s", resp.Status)
	}

	limited := io.LimitReader(resp.Body, maxRatioConfigBytes)
	bodyBytes, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	return convertModelsDevToRatioData(bytes.NewReader(bodyBytes))
}

// mergeOfficialRatioField adds official prices only for keys that do not exist
// locally. Existing local values always win.
func mergeOfficialRatioField(current map[string]float64, raw any) (map[string]float64, int) {
	merged := make(map[string]float64, len(current))
	for k, v := range current {
		merged[k] = v
	}

	added := 0
	if m, ok := raw.(map[string]any); ok {
		for k, v := range m {
			if _, exists := merged[k]; exists {
				continue
			}
			if f, ok := toFloat(v); ok {
				merged[k] = f
				added++
			}
		}
	}
	return merged, added
}

// applyOfficialPricing adds missing official prices to local pricing maps.
// Only model_ratio / completion_ratio / cache_ratio are present in the
// models.dev conversion.
func applyOfficialPricing(converted map[string]any) (int, error) {
	addedModels := 0

	if raw, ok := converted["model_ratio"]; ok {
		cur, added := mergeOfficialRatioField(ratio_setting.GetModelRatioCopy(), raw)
		if added > 0 {
			addedModels = added
			jsonStr, err := common.Marshal(cur)
			if err != nil {
				return addedModels, err
			}
			if err := model.UpdateOption("ModelRatio", string(jsonStr)); err != nil {
				return addedModels, err
			}
			if err := ratio_setting.UpdateModelRatioByJSONString(string(jsonStr)); err != nil {
				return addedModels, err
			}
		}
	}

	if raw, ok := converted["completion_ratio"]; ok {
		cur, added := mergeOfficialRatioField(ratio_setting.GetCompletionRatioCopy(), raw)
		if added > 0 {
			jsonStr, err := common.Marshal(cur)
			if err != nil {
				return addedModels, err
			}
			if err := model.UpdateOption("CompletionRatio", string(jsonStr)); err != nil {
				return addedModels, err
			}
			if err := ratio_setting.UpdateCompletionRatioByJSONString(string(jsonStr)); err != nil {
				return addedModels, err
			}
		}
	}

	if raw, ok := converted["cache_ratio"]; ok {
		cur, added := mergeOfficialRatioField(ratio_setting.GetCacheRatioCopy(), raw)
		if added > 0 {
			jsonStr, err := common.Marshal(cur)
			if err != nil {
				return addedModels, err
			}
			if err := model.UpdateOption("CacheRatio", string(jsonStr)); err != nil {
				return addedModels, err
			}
			if err := ratio_setting.UpdateCacheRatioByJSONString(string(jsonStr)); err != nil {
				return addedModels, err
			}
		}
	}

	return addedModels, nil
}

func toFloat(v any) (float64, bool) {
	switch f := v.(type) {
	case float64:
		return f, true
	case float32:
		return float64(f), true
	case int:
		return float64(f), true
	case int64:
		return float64(f), true
	}
	return 0, false
}

func nextOfficialSyncTime(now time.Time) time.Time {
	parsed, err := time.ParseInLocation("15:04", officialSyncTimeOfDay, now.Location())
	if err != nil {
		return now.Add(officialSyncInterval)
	}
	next := time.Date(now.Year(), now.Month(), now.Day(), parsed.Hour(), parsed.Minute(), 0, 0, now.Location())
	if !next.After(now) {
		next = next.AddDate(0, 0, 1)
	}
	return next
}

// RunOfficialPriceSync performs a single official price sync cycle. Safe to call
// from a scheduled task or a manual admin trigger.
func RunOfficialPriceSync() (int, error) {
	officialSyncMu.Lock()
	defer officialSyncMu.Unlock()

	defer func() {
		if r := recover(); r != nil {
			common.SysError(fmt.Sprintf("official price sync panic: %v", r))
		}
	}()

	converted, err := fetchOfficialPricing()
	if err != nil {
		officialSyncState.LastRunUnix = time.Now().Unix()
		officialSyncState.LastOK = false
		officialSyncState.LastError = err.Error()
		common.SysError("official price sync fetch failed: " + err.Error())
		return 0, err
	}

	merged, err := applyOfficialPricing(converted)
	officialSyncState.LastRunUnix = time.Now().Unix()
	if err != nil {
		officialSyncState.LastOK = false
		officialSyncState.LastError = err.Error()
		common.SysError("official price sync apply failed: " + err.Error())
		return merged, err
	}

	officialSyncState.LastOK = true
	officialSyncState.LastError = ""
	officialSyncState.LastModelsNum = merged
	common.SysLog(fmt.Sprintf("official price sync ok: %d models added", merged))
	return merged, nil
}

// StartOfficialPriceSyncTask runs the daily official price sync on the master
// node at 07:00 in the process local timezone.
func StartOfficialPriceSyncTask() {
	if !common.IsMasterNode {
		return
	}
	officialSyncOnce.Do(func() {
		go func() {
			for {
				next := nextOfficialSyncTime(time.Now())
				common.SysLog(fmt.Sprintf("official price sync scheduled at %s", next.Format(time.RFC3339)))
				time.Sleep(time.Until(next))
				_, _ = RunOfficialPriceSync()
			}
		}()
	})
}

// OfficialPriceSyncStatus returns a snapshot of the last sync state for the UI.
func OfficialPriceSyncStatus() map[string]any {
	officialSyncMu.Lock()
	defer officialSyncMu.Unlock()
	return map[string]any{
		"last_run_unix":   officialSyncState.LastRunUnix,
		"last_ok":         officialSyncState.LastOK,
		"last_error":      officialSyncState.LastError,
		"last_models_num": officialSyncState.LastModelsNum,
		"source_url":      officialPriceSourceURL,
	}
}
