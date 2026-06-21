package errornorm

import (
	"context"
	"sort"
	"strconv"
	"sync"
	"sync/atomic"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

// Store loads rules from DB, caches them locally, and exposes matching API.
type Store struct {
	db    *gorm.DB
	rules atomic.Pointer[[]*cachedRule]
	mu    sync.Mutex // serializes Reload calls
}

// NewStore creates a Store. Call Reload() once at startup before serving traffic.
func NewStore(db *gorm.DB) *Store {
	return &Store{db: db}
}

// Reload fetches all enabled rules from DB and atomically swaps the in-memory cache.
// Safe to call from a background sync goroutine.
func (s *Store) Reload(ctx context.Context) error {
	if s == nil || s.db == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	var rules []*Rule
	if err := s.db.WithContext(ctx).Where("enabled = ?", true).Order("priority ASC, id ASC").Find(&rules).Error; err != nil {
		return err
	}

	cached := make([]*cachedRule, 0, len(rules))
	for _, r := range rules {
		cached = append(cached, newCachedRule(r))
	}
	// Defensive: ensure deterministic order even if DB ignored ORDER BY
	sort.SliceStable(cached, func(i, j int) bool {
		if cached[i].rule.Priority != cached[j].rule.Priority {
			return cached[i].rule.Priority < cached[j].rule.Priority
		}
		return cached[i].rule.ID < cached[j].rule.ID
	})

	s.rules.Store(&cached)
	common.SysLog(formatReloadMsg(len(cached)))
	return nil
}

// Match returns the first matching rule (by priority) or nil.
func (s *Store) Match(platform string, status int, body string) *Rule {
	if s == nil {
		return nil
	}
	rulesPtr := s.rules.Load()
	if rulesPtr == nil {
		return nil
	}
	for _, c := range *rulesPtr {
		if c.matches(platform, status, body) {
			return c.rule
		}
	}
	return nil
}

// Count returns the number of cached rules (for /api/status integration).
func (s *Store) Count() int {
	rulesPtr := s.rules.Load()
	if rulesPtr == nil {
		return 0
	}
	return len(*rulesPtr)
}

// globalStore is set by SetGlobalStore() at startup. Nil means "no DB rules,
// fall back to FixedMessage()".
var globalStore atomic.Pointer[Store]

// SetGlobalStore registers the store for the Hook to use.
func SetGlobalStore(s *Store) {
	globalStore.Store(s)
}

// GlobalStore returns the registered store, or nil if not set.
func GlobalStore() *Store {
	return globalStore.Load()
}

func formatReloadMsg(n int) string {
	if n == 0 {
		return "errornorm: reloaded 0 rules (no DB rules configured, will use built-in FixedMessage)"
	}
	return "errornorm: reloaded " + strconv.Itoa(n) + " rules from DB"
}
