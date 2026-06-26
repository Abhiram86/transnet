package main

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
)

func handleConnection(conn net.Conn, saveDir string) {
	defer conn.Close()

	reader := bufio.NewReader(conn)
	numFilesStr, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("Error reading number of files:", err)
		return
	}
	numFilesStr = strings.TrimSpace(numFilesStr)
	numFiles, err := strconv.Atoi(numFilesStr)
	if err != nil {
		fmt.Println("Error reading number of files:", err)
		return
	}

	for i := 0; i < numFiles; i++ {
		header, err := reader.ReadString('\n')
		if err != nil {
			fmt.Println("Error reading header:", err)
			return
		}
		fmt.Println(header)

		details := strings.Split(strings.TrimSpace(header), "<|sep|>")
		if len(details) < 2 {
			fmt.Println("Invalid header format")
			return
		}
		fileName := details[0]
		fileSize, err := strconv.ParseInt(details[1], 10, 64)
		if err != nil {
			fmt.Println("Invalid file size:", err)
			return
		}

		outFile, err := os.Create(saveDir + "/" + fileName)
		if err != nil {
			fmt.Println("Error creating file:", err)
			return
		}

		_, err = io.CopyN(outFile, reader, fileSize)
		outFile.Close()
		if err != nil {
			fmt.Println("\nError reading from connection:", err)
			break
		}

		fmt.Printf("\nFile %d transfer complete!\n", i+1)
	}

	fmt.Println("Batch transfer complete! Auto-shutting down server.")
}

// Added UDP Broadcast receiver to sandbox server
func listenForUDPBroadcasts() {
	addr := &net.UDPAddr{
		IP:   net.IPv4zero,
		Port: 9090,
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		fmt.Println("Error starting UDP discovery listener:", err)
		return
	}
	defer conn.Close()

	fmt.Println("Listening for UDP Broadcasts on port 9090...")

	buf := make([]byte, 4096)
	for {
		n, senderAddr, err := conn.ReadFromUDP(buf)
		if err != nil {
			fmt.Println("UDP read error:", err)
			continue
		}

		message := string(buf[:n])
		
		// Parse the sender's device ID and hostname
		parts := strings.Split(message, "\n")
		if len(parts) < 4 || strings.TrimSpace(parts[0]) != "TRANSNET/1" || strings.TrimSpace(parts[1]) != "OFFER" {
			continue
		}
		senderDeviceID := strings.TrimSpace(parts[2])
		senderHostname := strings.TrimSpace(parts[3])
		
		fmt.Printf("\n--- NEW DEVICE DISCOVERED ---\nFrom IP: %s\nDevice ID: %s\nHostname: %s\n---------------------------\n", senderAddr.IP.String(), senderDeviceID, senderHostname)

		fmt.Printf("Sender addr string: %s\n", senderAddr.String())

		// Immediately auto-reply to complete the handshake!
		hostname, _ := os.Hostname()
		// Fake device ID for the desktop test server
		myDeviceID := "desktop-test-server-12345"

		// Ignore our own broadcast if we happen to hear it
		if senderDeviceID == myDeviceID {
			continue
		}

		replyMsg := fmt.Sprintf("TRANSNET/1\nACCEPT\n%s\n%s\n", myDeviceID, hostname)
		conn.WriteToUDP([]byte(replyMsg), senderAddr)
		fmt.Println("Sent UDP acceptance handshake back to sender!")
	}
}

func main() {
	// Start UDP discovery in background
	go listenForUDPBroadcasts()

	listener, err := net.Listen("tcp", ":8080")
	if err != nil {
		fmt.Println("Error starting server:", err)
		os.Exit(1)
	}

	defer listener.Close()
	for {
		conn, err := listener.Accept()
		if err != nil {
			fmt.Println("Error accepting connection:", err)
			os.Exit(1)
		}
		go handleConnection(conn, ".")
	}
}
