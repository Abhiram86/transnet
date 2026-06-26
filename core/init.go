package core

import (
	"bytes"
	"fmt"
	"net"
	"os"

	"github.com/google/uuid"
)

var myDeviceID string

func InitCore(storageDir string) error {
	idFile := storageDir + "/.transnet-id"
	b, err := os.ReadFile(idFile)
	if err == nil && len(bytes.TrimSpace(b)) > 0 {
		myDeviceID = string(bytes.TrimSpace(b))
	} else {
		myDeviceID = uuid.New().String()
		_ = os.WriteFile(idFile, []byte(myDeviceID), 0644)
	}
	return nil
}

func init() {
	// Fallback for non-mobile testing
	myDeviceID = uuid.New().String()
}

func TestGoEngine(name string) string {
	return fmt.Sprintf("Go Engine says: Hello %s! The engine is running.", name)
}

func GetLocalIP() (string, error) {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "", err
	}
	defer conn.Close()

	localAddr := conn.LocalAddr().(*net.UDPAddr)
	return localAddr.IP.String(), nil
}
