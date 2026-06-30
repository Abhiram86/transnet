package core

import (
	"fmt"
	"sync"
)

type Progress struct {
	TotalFiles     int
	CurrentFileIdx int
	TotalBytes     int64
	CurrentBytes   int64
	PercentDone    float64
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

func GetClientProgressStr() string {
	clientProgressMutex.RLock()
	defer clientProgressMutex.RUnlock()
	p := clientCurrentProgress
	return fmt.Sprintf("%d<|sep|>%d<|sep|>%d<|sep|>%d<|sep|>%.1f",
		p.TotalFiles, p.CurrentFileIdx, p.TotalBytes, p.CurrentBytes, p.PercentDone)
}

func GetServerProgressStr() string {
	serverProgressMutex.RLock()
	defer serverProgressMutex.RUnlock()
	p := serverCurrentProgress
	return fmt.Sprintf("%d<|sep|>%d<|sep|>%d<|sep|>%d<|sep|>%.1f",
		p.TotalFiles, p.CurrentFileIdx, p.TotalBytes, p.CurrentBytes, p.PercentDone)
}
