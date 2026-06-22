package controller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsPrivateMetricsClientIP(t *testing.T) {
	require.True(t, isPrivateMetricsClientIP("127.0.0.1"))
	require.True(t, isPrivateMetricsClientIP("10.0.0.1"))
	require.True(t, isPrivateMetricsClientIP("192.168.1.20"))
	require.False(t, isPrivateMetricsClientIP("8.8.8.8"))
	require.False(t, isPrivateMetricsClientIP("not-an-ip"))
}
