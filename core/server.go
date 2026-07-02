package core

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

var activeListener net.Listener

var skipCurrentFile atomic.Bool

func handleConnection(ctx context.Context, cancel context.CancelFunc, conn net.Conn, saveDir string) error {
	conn.SetDeadline(time.Now().Add(5 * time.Minute))

	reader := bufio.NewReader(conn)
	numFilesStr, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("reading file count: %v", err)
	}

	numFilesStr = strings.TrimSpace(numFilesStr)
	numFiles, err := strconv.Atoi(numFilesStr)
	if err != nil {
		return fmt.Errorf("invalid file count: %v", err)
	}

	updateServerProgress(func(p *Progress) {
		p.TotalFiles = numFiles
	})
	go func() {
		defer conn.Close()
		defer cancel()

		setServerStatus("transferring")

		for i := range numFiles {
			select {
			case <-ctx.Done():
				setServerStatus("cancelled")
				return
			default:
			}

			header, err := reader.ReadString('\n')
			if err != nil {
				setServerStatus("error reading header: " + err.Error())
				return
			}
			details := strings.Split(strings.TrimSpace(header), "<|sep|>")
			if len(details) < 2 {
				setServerStatus("error: invalid header")
				return
			}
			fileName := filepath.Base(details[0])

			updateServerProgress(func(p *Progress) {
				p.CurrentFileIdx = i
				p.CurrentFileName = fileName
			})

			err = receiveSingleFile(ctx, reader, saveDir, fileName, details[1])
			if err != nil {
				if ctx.Err() != nil {
					setServerStatus("cancelled")
				} else {
					setServerStatus("error: " + err.Error())
				}
				return
			}
			fmt.Printf("File %d/%d received\n", i+1, numFiles)
		}

		setServerStatus("done")
	}()

	return nil
}

func SignalSkipCurrentFile() {
	skipCurrentFile.Store(true)
}

func receiveSingleFile(ctx context.Context, reader *bufio.Reader, saveDir string, fileName string, fileSizeStr string) error {
	fileSize, err := strconv.ParseInt(fileSizeStr, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid file size: %v", err)
	}

	partPath := saveDir + "/" + fileName + ".part"
	outFile, err := os.Create(partPath)
	if err != nil {
		return fmt.Errorf("creating file: %v", err)
	}

	buf := make([]byte, 32*1024)

	var received int64
	lastProgressUpdate := time.Now()
	skipped := false

	for received < fileSize {
		select {
		case <-ctx.Done():
			outFile.Close()
			os.Remove(partPath)
			return ctx.Err()
		default:
		}

		if skipCurrentFile.Load() {
			skipCurrentFile.Store(false)
			skipped = true
			outFile.Close()
			os.Remove(partPath)

			for received < fileSize {
				drainSize := int64(len(buf))
				remaining := fileSize - received
				if remaining < drainSize {
					drainSize = remaining
				}
				n, drainErr := io.ReadFull(reader, buf[:drainSize])
				received += int64(n)
				if drainErr != nil {
					if drainErr == io.EOF {
						break
					}
					return fmt.Errorf("draining skipped file: %w", drainErr)
				}
			}

			updateServerProgress(func(p *Progress) {
				p.CurrentBytes = fileSize
				p.TotalBytes = fileSize
				p.PercentDone = 100
			})

			fmt.Printf("Skipped file: %s\n", fileName)
			return nil
		}

		remaining := fileSize - received
		readSize := len(buf)
		if remaining < int64(readSize) {
			readSize = int(remaining)
		}

		n, err := io.ReadFull(reader, buf[:readSize])

		if n > 0 {
			writtenTotal := 0
			for writtenTotal < n {
				written, writeErr := outFile.Write(buf[writtenTotal:n])
				if writeErr != nil {
				outFile.Close()
				os.Remove(partPath)
				return fmt.Errorf("writing file: %w", writeErr)
				}
				if written == 0 {
				outFile.Close()
				os.Remove(partPath)
				return fmt.Errorf("writing file: wrote 0 bytes without error")
				}
				writtenTotal += written
			}

			received += int64(n)

			if time.Since(lastProgressUpdate) >= 50*time.Millisecond || received == fileSize {
				updateServerProgress(func(p *Progress) {
					p.CurrentFileName = fileName
					p.CurrentBytes = received
					p.TotalBytes = fileSize
					if fileSize > 0 {
						p.PercentDone = float64(received) * 100 / float64(fileSize)
					} else {
						p.PercentDone = 100
					}
				})

				lastProgressUpdate = time.Now()
			}
		}

		if err == io.EOF {
			break
		}
		if err != nil {
			outFile.Close()
			os.Remove(partPath)
			return fmt.Errorf("reading data: %w", err)
		}
	}

	outFile.Close()

	finalPath := saveDir + "/" + fileName
	if renameErr := os.Rename(partPath, finalPath); renameErr != nil {
		os.Remove(partPath)
		return fmt.Errorf("renaming part file: %w", renameErr)
	}

	if !skipped {
		updateServerProgress(func(p *Progress) {
			p.CurrentBytes = fileSize
			p.TotalBytes = fileSize
			p.PercentDone = 100
		})
	}

	return nil
}

func StartServer(port, saveDir string) (string, error) {
	if activeListener != nil {
		return "Server already running", nil
	}

	ctx, cancel := context.WithCancel(context.Background())

	serverCtxMu.Lock()
	serverCtx = ctx
	serverCancel = cancel
	serverCtxMu.Unlock()

	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return "", fmt.Errorf("Error starting server: %v", err)
	}
	activeListener = listener
	setServerStatus("listening")
	defer func() {
		listener.Close()
		activeListener = nil
	}()

	conn, err := listener.Accept()
	if err != nil {
		return "", fmt.Errorf("Error accepting connection: %v", err)
	}

	handleConnection(ctx, cancel, conn, saveDir)

	return "Transfer complete", nil
}

func GetServerProgress() Progress {
	serverProgressMutex.RLock()
	defer serverProgressMutex.RUnlock()

	return serverCurrentProgress
}

func GetServerStatus() string {
	serverStatusMutex.RLock()
	defer serverStatusMutex.RUnlock()

	return serverStatus
}

func StopServer() error {
	if activeListener != nil {
		err := activeListener.Close()
		activeListener = nil
		return err
	}
	return nil
}
