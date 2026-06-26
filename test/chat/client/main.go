package main

import (
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"time"
)

func main() {
	// 1. UDP DISCOVERY HANDSHAKE
	fmt.Println("Broadcasting UDP discovery...")

	udpConn, err := net.ListenUDP("udp", nil)
	if err != nil {
		fmt.Println("Error starting UDP listener:", err)
		os.Exit(1)
	}

	fmt.Println("UDP local address:", udpConn.LocalAddr())

	broadcastAddr := &net.UDPAddr{
		IP:   net.IPv4bcast,
		Port: 9090,
	}

	hostname, _ := os.Hostname()
	myDeviceID := "desktop-test-client-98765"
	offerMsg := fmt.Sprintf("TRANSNET/1\nOFFER\n%s\n%s\n", myDeviceID, hostname)

	fmt.Println("Waiting for receiver to accept...")
	buf := make([]byte, 1024)

	var receiverIP, receiverDeviceID, receiverName string

	for {
		_, err = udpConn.WriteToUDP([]byte(offerMsg), broadcastAddr)
		if err != nil {
			fmt.Println("Error broadcasting UDP:", err)
			os.Exit(1)
		}

		// Wait up to 1 second for a response
		udpConn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, receiverAddr, err := udpConn.ReadFromUDP(buf)
		if err != nil {
			if !os.IsTimeout(err) {
				time.Sleep(200 * time.Millisecond) // Ignore ICMP "Connection Refused"
			}
			continue // broadcast again
		}

		replyString := string(buf[:n])
		parts := strings.Split(replyString, "\n")

		if len(parts) < 4 || strings.TrimSpace(parts[0]) != "TRANSNET/1" || strings.TrimSpace(parts[1]) != "ACCEPT" {
			continue
		}

		receiverDeviceID = strings.TrimSpace(parts[2])

		// If the first line matches our own device ID, it's an echo of our own broadcast. Ignore it!
		if receiverDeviceID == myDeviceID {
			fmt.Println("Ignored my own broadcast echo from", receiverAddr.IP.String())
			continue
		}

		receiverIP = receiverAddr.IP.String()
		receiverName = strings.TrimSpace(parts[3])
		break // We found a real receiver! Break out of the listening loop.
	}

	fmt.Printf("Discovered %s (ID: %s) at %s! Starting TCP transfer...\n", receiverName, receiverDeviceID, receiverIP)
	udpConn.Close()

	// 2. TCP TRANSFER
	var conn net.Conn
	for i := 0; i < 10; i++ {
		conn, err = net.Dial("tcp", receiverIP+":8080")
		if err == nil {
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	if err != nil {
		fmt.Println("Error dialing client connection:", err)
		os.Exit(1)
	}
	defer conn.Close()

	// Hardcoded files
	filePaths := []string{
		"anime_scenary.jpg",
		"uwp4766922.png",
		"Abhiram Alla - Resume.pdf",
	}

	files := make([]*os.File, len(filePaths))

	for i, path := range filePaths {
		file, err := os.Open(path)
		if err != nil {
			fmt.Printf("Error opening %s: %v\n", path, err)
			os.Exit(1)
		}
		files[i] = file
	}

	defer func() {
		for _, file := range files {
			file.Close()
		}
	}()

	// Send file count
	fmt.Fprintf(conn, "%d\n", len(files))

	for _, file := range files {
		fileInfo, err := file.Stat()
		if err != nil {
			fmt.Println("Error reading file stats:", err)
			os.Exit(1)
		}

		// Send header
		header := fmt.Sprintf("%s<|sep|>%d\n", fileInfo.Name(), fileInfo.Size())
		conn.Write([]byte(header))

		fmt.Println("Sending:", header)

		// Stream file contents
		_, err = io.Copy(conn, file)
		if err != nil {
			fmt.Println("Error streaming file:", err)
			os.Exit(1)
		}

		fmt.Printf("Finished sending %s\n", fileInfo.Name())
	}

	fmt.Println("All files sent.")
}
