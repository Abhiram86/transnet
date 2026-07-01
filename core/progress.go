package core

import (
	"context"
	"fmt"
	"sync"
)

type Progress struct {
	TotalFiles      int
	CurrentFileIdx  int
	CurrentFileName string
	TotalBytes      int64
	CurrentBytes    int64
	PercentDone     float64
}

var (
	clientCurrentProgress Progress
	clientProgressMutex   sync.RWMutex
	clientStatus          string
	clientStatusMutex     sync.RWMutex
)

var (
	serverCurrentProgress Progress
	serverProgressMutex   sync.RWMutex
	serverStatus          string
	serverStatusMutex     sync.RWMutex
)

var (
	clientCtx    context.Context
	clientCancel context.CancelFunc
	clientCtxMu  sync.Mutex
)

var (
	serverCtx    context.Context
	serverCancel context.CancelFunc
	serverCtxMu  sync.Mutex
)

func updateClientProgress(fn func(p *Progress)) {
	clientProgressMutex.Lock()
	fn(&clientCurrentProgress)
	clientProgressMutex.Unlock()
}

func updateServerProgress(fn func(p *Progress)) {
	serverProgressMutex.Lock()
	fn(&serverCurrentProgress)
	serverProgressMutex.Unlock()
}

func setClientStatus(s string) {
	clientStatusMutex.Lock()
	clientStatus = s
	clientStatusMutex.Unlock()
}

func setServerStatus(s string) {
	serverStatusMutex.Lock()
	serverStatus = s
	serverStatusMutex.Unlock()
}

func CancelClientTransfer() {
	clientCtxMu.Lock()
	defer clientCtxMu.Unlock()
	if clientCancel != nil {
		clientCancel()
		clientCancel = nil
		clientCtx = nil
	}
}

func CancelServerTransfer() {
	serverCtxMu.Lock()
	defer serverCtxMu.Unlock()
	if serverCancel != nil {
		serverCancel()
		serverCancel = nil
		serverCtx = nil
	}
}

func GetClientProgressStr() string {
	clientProgressMutex.RLock()
	defer clientProgressMutex.RUnlock()
	p := clientCurrentProgress
	return fmt.Sprintf("%d<|sep|>%d<|sep|>%s<|sep|>%d<|sep|>%d<|sep|>%.1f",
		p.TotalFiles, p.CurrentFileIdx, p.CurrentFileName, p.TotalBytes, p.CurrentBytes, p.PercentDone)
}

func GetServerProgressStr() string {
	serverProgressMutex.RLock()
	defer serverProgressMutex.RUnlock()
	p := serverCurrentProgress
	return fmt.Sprintf("%d<|sep|>%d<|sep|>%s<|sep|>%d<|sep|>%d<|sep|>%.1f",
		p.TotalFiles, p.CurrentFileIdx, p.CurrentFileName, p.TotalBytes, p.CurrentBytes, p.PercentDone)
}
