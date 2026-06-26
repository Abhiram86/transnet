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
	defer conn.Close()
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

	for i := 0; i < numFiles; i++ {
		err := receiveSingleFile(reader, saveDir)
		if err != nil {
			return fmt.Errorf("file %d: %v", i+1, err)
		}
		fmt.Printf("File %d/%d received\n", i+1, numFiles)
	}

	return nil
}

func receiveSingleFile(reader *bufio.Reader, saveDir string) error {
	header, err := reader.ReadString('\n')
	if err != nil {
		return fmt.Errorf("reading header: %v", err)
	}

	details := strings.Split(strings.TrimSpace(header), "<|sep|>")
	if len(details) < 2 {
		return fmt.Errorf("invalid header format")
	}
	fileName := filepath.Base(details[0])
	fileSize, err := strconv.ParseInt(details[1], 10, 64)
	if err != nil {
		return fmt.Errorf("invalid file size: %v", err)
	}

	outFile, err := os.Create(saveDir + "/" + fileName)
	if err != nil {
		return fmt.Errorf("creating file: %v", err)
	}
	defer outFile.Close()

	_, err = io.CopyN(outFile, reader, fileSize)
	if err != nil {
		return fmt.Errorf("reading data: %v", err)
	}
	return nil
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
	defer func() {
		listener.Close()
		activeListener = nil
	}()

	conn, err := listener.Accept()
	if err != nil {
		return "", fmt.Errorf("Error accepting connection: %v", err)
	}

	err = handleConnection(conn, saveDir)
	if err != nil {
		return "", fmt.Errorf("transfer failed: %v", err)
	}

	return "Transfer complete", nil
}

func StopServer() error {
	if activeListener != nil {
		err := activeListener.Close()
		activeListener = nil
		return err
	}
	return nil
}
