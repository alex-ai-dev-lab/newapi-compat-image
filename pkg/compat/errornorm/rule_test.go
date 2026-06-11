package errornorm

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRule_Matches(t *testing.T) {
	rule := &Rule{
		Enabled:        true,
		Platforms:      "1,14",
		UpstreamStatus: 429,
		Keywords:       "rate limit, quota exceeded",
	}
	c := newCachedRule(rule)

	require.True(t, c.matches("1", 429, "Rate Limit exceeded for org"))
	require.True(t, c.matches("14", 429, "your QUOTA EXCEEDED for today"))
	require.False(t, c.matches("99", 429, "rate limit"), "platform mismatch")
	require.False(t, c.matches("1", 500, "rate limit"), "status mismatch")
	require.False(t, c.matches("1", 429, "everything is fine"), "keyword mismatch")
}

func TestRule_DisabledNeverMatches(t *testing.T) {
	rule := &Rule{Enabled: false, UpstreamStatus: 400}
	c := newCachedRule(rule)
	require.False(t, c.matches("1", 400, "any body"))
}

func TestRule_EmptyFiltersMatchAll(t *testing.T) {
	rule := &Rule{Enabled: true}
	c := newCachedRule(rule)
	require.True(t, c.matches("99", 0, ""))
	require.True(t, c.matches("anything", 500, "literally anything"))
}

func TestStore_MatchPicksFirstByPriority(t *testing.T) {
	s := &Store{}
	rules := []*cachedRule{
		newCachedRule(&Rule{ID: 2, Enabled: true, UpstreamStatus: 429, Priority: 100, CustomMessage: "second"}),
		newCachedRule(&Rule{ID: 1, Enabled: true, UpstreamStatus: 429, Priority: 50, CustomMessage: "first"}),
	}
	// Sort by priority manually (mimics Reload's behavior).
	rulesSorted := []*cachedRule{rules[1], rules[0]}
	s.rules.Store(&rulesSorted)

	hit := s.Match("any", 429, "anything")
	require.NotNil(t, hit)
	require.Equal(t, "first", hit.CustomMessage)
}
