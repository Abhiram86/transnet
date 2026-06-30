package core

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var activeListener net.Listener

func handleConnection(conn net.Conn, saveDir string) error {
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

		setServerStatus("transferring")

		for i := range numFiles {
			fileName, err := receiveSingleFile(reader, saveDir)
			if err != nil {
				setServerStatus("error: " + err.Error())
				return
			}
			updateServerProgress(func(p *Progress) {
				p.CurrentFileIdx = i
				p.CurrentFileName = fileName
			})
			fmt.Printf("File %d/%d received\n", i+1, numFiles)
		}

		setServerStatus("done")
	}()

	return nil
}

func receiveSingleFile(reader *bufio.Reader, saveDir string) (string, error) {
	header, err := reader.ReadString('\n')
	if err != nil {
	return "", fmt.Errorf("reading header: %v", err)
	}

	details := strings.Split(strings.TrimSpace(header), "<|sep|>")
	if len(details) < 2 {
		return "", fmt.Errorf("invalid header format")
	}
	fileName := filepath.Base(details[0])
	fileSize, err := strconv.ParseInt(details[1], 10, 64)
	if err != nil {
		return "", fmt.Errorf("invalid file size: %v", err)
	}

	outFile, err := os.Create(saveDir + "/" + fileName)
	if err != nil {
		return "", fmt.Errorf("creating file: %v", err)
	}
	defer outFile.Close()

	buf := make([]byte, 32*1024)

	var received int64
	lastProgressUpdate := time.Now()

	for received < fileSize {
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
				return "", fmt.Errorf("writing file: %w", writeErr)
				}
				if written == 0 {
				return "", fmt.Errorf("writing file: wrote 0 bytes without error")
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
			return "", fmt.Errorf("reading data: %w", err)
		}
	}

	updateServerProgress(func(p *Progress) {
		p.CurrentBytes = fileSize
		p.TotalBytes = fileSize
		p.PercentDone = 100
	})

	return fileName, nil
}

func StartServer(port, saveDir string) (string, error) {
	if activeListener != nil {
		return "Server already running", nil
	}

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

	handleConnection(conn, saveDir)

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
