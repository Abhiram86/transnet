package core

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func SendFile(ip string, port string, filePathsStr string) error {
	filePaths := strings.Split(filePathsStr, "<|sep|>")

	ctx, cancel := context.WithCancel(context.Background())

	clientCtxMu.Lock()
	clientCtx = ctx
	clientCancel = cancel
	clientCtxMu.Unlock()

	updateClientProgress(func(p *Progress) {
		p.TotalFiles = len(filePaths)
	})
	setClientStatus("connecting")

	var conn net.Conn
	var err error
	for i := 0; i < 10; i++ {
		conn, err = net.Dial("tcp", ip+":"+port)
		if err == nil {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if err != nil {
		setClientStatus("error: " + err.Error())
		return fmt.Errorf("error dialing client connection: %v", err)
	}

	conn.SetDeadline(time.Now().Add(5 * time.Minute))

	fmt.Fprintf(conn, "%d\n", len(filePaths))

	go func() {
		defer conn.Close()
		defer cancel()

		setClientStatus("transferring")

		for i, filePath := range filePaths {
			select {
			case <-ctx.Done():
				setClientStatus("cancelled")
				return
			default:
			}

			fileName := filepath.Base(filePath)
			updateClientProgress(func(p *Progress) {
				p.CurrentFileIdx = i
				p.CurrentFileName = fileName
			})

			err := sendSingleFile(ctx, conn, filePath)
			if err != nil {
				if ctx.Err() != nil {
					setClientStatus("cancelled")
				} else {
					setClientStatus("error: " + err.Error())
				}
				return
			}
		}

		setClientStatus("done")
	}()

	return nil
}

func sendSingleFile(ctx context.Context, conn net.Conn, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("error opening file: %w", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("error reading file stats: %w", err)
	}

	fileSize := fileInfo.Size()

	// Send file header first.
	header := fmt.Sprintf("%s<|sep|>%d\n", fileInfo.Name(), fileSize)
	if _, err := conn.Write([]byte(header)); err != nil {
		return fmt.Errorf("error writing header: %w", err)
	}

	// 32 KiB buffer.
	buf := make([]byte, 32*1024)

	var sent int64
	lastProgressUpdate := time.Now()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		n, readErr := file.Read(buf)
		if n > 0 {
			// Write all bytes, even if conn.Write does a partial write.
			writtenTotal := 0
			for writtenTotal < n {
				select {
				case <-ctx.Done():
					return ctx.Err()
				default:
				}

				written, writeErr := conn.Write(buf[writtenTotal:n])
				if writeErr != nil {
					return fmt.Errorf("error streaming file: %w", writeErr)
				}
				if written == 0 {
					return fmt.Errorf("error streaming file: wrote 0 bytes without error")
				}
				writtenTotal += written
			}

			sent += int64(n)

			// Throttle progress updates a bit so you do not spam locks/UI.
			if time.Since(lastProgressUpdate) >= 50*time.Millisecond || sent == fileSize {
				updateClientProgress(func(p *Progress) {
					p.CurrentFileName = fileInfo.Name()
					p.CurrentBytes = int64(sent)
					p.TotalBytes = int64(fileSize)
					if fileSize > 0 {
						p.PercentDone = float64(sent) * 100 / float64(fileSize)
					} else {
						p.PercentDone = 100
					}
				})

				lastProgressUpdate = time.Now()
			}
		}

		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return fmt.Errorf("error reading file: %w", readErr)
		}
	}

	// Final update to ensure 100%.
	updateClientProgress(func(p *Progress) {
		p.CurrentBytes = int64(fileSize)
		p.TotalBytes = int64(fileSize)
		p.PercentDone = 100
	})

	return nil
}

func GetClientProgress() Progress {
	clientProgressMutex.RLock()
	defer clientProgressMutex.RUnlock()

	return clientCurrentProgress
}

func GetClientStatus() string {
	clientStatusMutex.RLock()
	defer clientStatusMutex.RUnlock()

	return clientStatus
}
