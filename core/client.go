package core

import (
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"time"
)

func SendFile(ip string, port string, filePathsStr string) error {
	filePaths := strings.Split(filePathsStr, "<|sep|>")

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
		return fmt.Errorf("error dialing client connection: %v", err)
	}

	defer conn.Close()
	conn.SetDeadline(time.Now().Add(5 * time.Minute))

	fmt.Fprintf(conn, "%d\n", len(filePaths))

	for _, filePath := range filePaths {
		err := sendSingleFile(conn, filePath)
		if err != nil {
			return err
		}
	}

	return nil
}

func sendSingleFile(conn net.Conn, filePath string) error {
	file, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("error opening file: %v", err)
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return fmt.Errorf("error reading file stats: %v", err)
	}

	header := fmt.Sprintf("%s<|sep|>%d\n", fileInfo.Name(), fileInfo.Size())
	_, err = conn.Write([]byte(header))
	if err != nil {
		return fmt.Errorf("error writing header: %v", err)
	}

	_, err = io.Copy(conn, file)
	if err != nil {
		return fmt.Errorf("error streaming file: %v", err)
	}

	return nil
}
