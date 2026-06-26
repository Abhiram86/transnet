package core

import (
	"fmt"
	"net"
	"os"
	"time"
)

type DiscoveryService struct {
	conn *net.UDPConn
}

var activeDiscoveryService *DiscoveryService

func startDiscoveryService(port int) error {
	if activeDiscoveryService != nil && activeDiscoveryService.conn != nil {
		return nil
	}
	addr := &net.UDPAddr{
		IP:   net.IPv4zero,
		Port: port,
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return err
	}

	activeDiscoveryService = &DiscoveryService{
		conn: conn,
	}

	return nil
}

func StopDiscoveryService() error {
	if activeDiscoveryService != nil && activeDiscoveryService.conn != nil {
		err := activeDiscoveryService.conn.Close()
		activeDiscoveryService = nil
		return err
	}
	return nil
}

func initiateFileTransfer() (*FileTransferOffer, error) {
	hostname, err := os.Hostname()
	if err != nil {
		return nil, fmt.Errorf("hostname error: %v", err)
	}

	payload := fmt.Sprintf("%s\n%s\n%s\n%s\n", ProtocolVersion, MsgOffer, myDeviceID, hostname)

	conn, err := net.ListenUDP("udp", nil)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	broadcastAddr := &net.UDPAddr{
		IP:   net.IPv4bcast,
		Port: 9090,
	}

	fmt.Println("Broadcast sent from:", conn.LocalAddr())
	fmt.Println(payload)

	deadline := time.Now().Add(20 * time.Second)
	buf := make([]byte, 1024)

	for {
		_, err = conn.WriteToUDP([]byte(payload), broadcastAddr)
		if err != nil {
			return nil, err
		}

		conn.SetReadDeadline(time.Now().Add(1 * time.Second))
		n, receiverAddr, err := conn.ReadFromUDP(buf)
		if err != nil {
			if time.Now().After(deadline) {
				return nil, fmt.Errorf("discovery timeout")
			}
			if !os.IsTimeout(err) {
				time.Sleep(200 * time.Millisecond) // Ignore ICMP "Connection Refused"
			}
			continue
		}

		rawPacket := string(buf[:n])
		packet, err := ParseDiscoveryPacket(rawPacket)
		if err != nil {
			continue
		}

		if packet.Version == ProtocolVersion && packet.Type == MsgAccept {
			if packet.DeviceID == myDeviceID {
				continue
			}

			return &FileTransferOffer{
				Ip:         receiverAddr.IP.String(),
				Hostname:   packet.Hostname,
				SenderAddr: receiverAddr.String(),
			}, nil
		}
	}
}

func listenFileTransfer() (*FileTransferOffer, error) {
	err := startDiscoveryService(9090)
	if err != nil {
		return nil, err
	}

	conn := activeDiscoveryService.conn

	err = conn.SetReadDeadline(time.Now().Add(30 * time.Second))
	if err != nil {
		return nil, err
	}

	buf := make([]byte, 4096)

	for {
		n, senderAddr, err := conn.ReadFromUDP(buf)
		if err != nil {
			return nil, err
		}

		rawPacket := string(buf[:n])
		fmt.Println("Received packet from:", senderAddr)
		fmt.Printf("Raw packet: %q\n", rawPacket)

		packet, err := ParseDiscoveryPacket(rawPacket)
		if err != nil {
			continue
		}

		if packet.Version == ProtocolVersion && packet.Type == MsgOffer {
			if packet.DeviceID == myDeviceID {
				continue
			}

			offer := FileTransferOffer{
				Hostname:   packet.Hostname,
				Ip:         senderAddr.IP.String(),
				SenderAddr: senderAddr.String(),
			}
			return &offer, nil
		}
	}
}

func acceptFileTransfer(senderAddr string) error {
	conn, err := net.Dial("udp", senderAddr)
	if err != nil {
		return err
	}
	defer conn.Close()

	hostname, _ := os.Hostname()
	msg := fmt.Sprintf("%s\n%s\n%s\n%s\n", ProtocolVersion, MsgAccept, myDeviceID, hostname)

	fmt.Println("Sending ACCEPT to:", senderAddr)

	_, err = conn.Write([]byte(msg))
	return err
}

// Exported wrappers for Gomobile/Expo

func InitiateFileTransfer() (string, error) {
	offer, err := initiateFileTransfer()
	if err != nil {
		return "", err
	}
	return offer.Hostname + "<|sep|>" + offer.Ip + "<|sep|>" + offer.SenderAddr, nil
}

func ListenFileTransfer() (string, error) {
	offer, err := listenFileTransfer()
	if err != nil {
		return "", err
	}

	return offer.Hostname + "<|sep|>" + offer.Ip + "<|sep|>" + offer.SenderAddr, nil
}

func AcceptFileTransfer(senderAddr string) error {
	return acceptFileTransfer(senderAddr)
}
