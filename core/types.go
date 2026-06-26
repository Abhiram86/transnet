package core

import (
	"fmt"
	"strings"
)

const (
	ProtocolVersion = "TRANSNET/1"
	MsgOffer        = "OFFER"
	MsgAccept       = "ACCEPT"
	MsgReject       = "REJECT"
)

type DiscoveryPacket struct {
	Version  string
	Type     string
	DeviceID string
	Hostname string
}

func ParseDiscoveryPacket(raw string) (*DiscoveryPacket, error) {
	parts := strings.Split(strings.TrimSpace(raw), "\n")
	if len(parts) < 4 {
		return nil, fmt.Errorf("packet too short")
	}
	return &DiscoveryPacket{
		Version:  strings.TrimSpace(parts[0]),
		Type:     strings.TrimSpace(parts[1]),
		DeviceID: strings.TrimSpace(parts[2]),
		Hostname: strings.TrimSpace(parts[3]),
	}, nil
}

type FileTransferOffer struct {
	Hostname   string
	Ip         string
	SenderAddr string
}
