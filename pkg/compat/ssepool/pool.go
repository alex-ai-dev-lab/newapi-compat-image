package ssepool

import "sync"

const sseScannerBuf64KSize = 64 * 1024

type sseScannerBuf64K [sseScannerBuf64KSize]byte

var sseScannerBuf64KPool = sync.Pool{
	New: func() any {
		return new(sseScannerBuf64K)
	},
}

// Get returns a 64KB buffer from the pool.
func Get() *sseScannerBuf64K {
	v := sseScannerBuf64KPool.Get()
	buf, ok := v.(*sseScannerBuf64K)
	if !ok || buf == nil {
		return new(sseScannerBuf64K)
	}
	return buf
}

// Put returns a 64KB buffer to the pool.
func Put(buf *sseScannerBuf64K) {
	if buf == nil {
		return
	}
	sseScannerBuf64KPool.Put(buf)
}
