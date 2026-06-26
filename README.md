# TransNet

A peer-to-peer file transfer app for Android. Discovers nearby devices over UDP broadcast and transfers files directly over TCP — no internet or router required.

## How it works

1. **Sender** broadcasts a UDP discovery packet to the local network
2. **Receiver** picks up the broadcast and replies with an acceptance
3. Sender opens a TCP connection and streams the files
4. Receiver saves them to local storage

The whole flow is automatic — pick files, tap search, tap send.

## Architecture

```
UI (Expo / React Native)
        ↓
Native Module Bridge (Expo Modules API)
        ↓
Kotlin Android Layer (permissions, lifecycle, file resolution)
        ↓
Go Transfer Engine (gomobile AAR)
        ↓
Protocol: UDP discovery → TCP transfer
```

The Go engine knows nothing about BLE, Wi-Fi Direct, or Android. It only knows: "a connection was established, bytes can be sent/received."

## Project structure

```
transnet/
├── app/                          # Expo React Native app
│   ├── src/
│   │   ├── app/
│   │   │   ├── _layout.tsx       # Root layout with custom tabs
│   │   │   ├── index.tsx         # Send screen (3-step wizard)
│   │   │   └── receive.tsx       # Receive screen (3-step wizard)
│   │   ├── components/
│   │   │   ├── CustomTabBar.tsx  # Animated bottom tab bar
│   │   │   └── StepIndicator.tsx # Progress dots for step flow
│   │   └── constants/
│   │       └── theme.ts          # Colors and theme constants
│   └── modules/
│       └── transnet/
│           ├── src/
│           │   ├── TransnetModule.ts       # JS module (web stub + native import)
│           │   └── Transnet.types.ts       # TypeScript event types
│           └── android/
│               ├── src/main/java/.../TransnetModule.kt   # Kotlin bridge
│               └── libs/transnetcore.aar                  # Pre-built Go engine
│
├── core/                         # Go transfer engine (source)
│   ├── types.go                  # Protocol constants, packet parsing
│   ├── init.go                   # UUID persistence, local IP detection
│   ├── discovery.go              # UDP broadcast, listen, accept
│   ├── server.go                 # TCP server — receives files
│   ├── client.go                 # TCP client — sends files
│   └── go.mod
│
└── test/                         # Desktop test tools (not unit tests)
    └── chat/
        ├── client/main.go        # Test sender — discovers + sends files
        └── server/main.go        # Test receiver — listens + accepts files
```

## Running the app

### Android (device or emulator)

```bash
cd app
pnpm install
npx expo prebuild --platform android
npx expo run:android
```

### Web (UI preview only — no native networking)

```bash
cd app
pnpm install
pnpm run web
```

On web, all native module calls return stub values so you can preview the UI.

### Test tools (desktop)

```bash
# Terminal 1 — receiver
cd test/chat/server
go run main.go

# Terminal 2 — sender
cd test/chat/client
go run main.go
```

The test client broadcasts a UDP discovery, the test server responds, then the client sends hardcoded files over TCP.

## Building the Go AAR

Only needed if you modify files in `core/`:

```bash
cd core
gomobile bind -target=android -androidapi 21 -o ../app/modules/transnet/android/libs/transnetcore.aar .
```

## Releases

Push a version tag to trigger the GitHub Actions workflow:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This builds a release APK and publishes it to GitHub Releases.

## Tech stack

- **Frontend**: Expo 56, React Native 0.85, TypeScript
- **Navigation**: expo-router with custom tabs (expo-router/ui)
- **Animations**: react-native-reanimated
- **Native bridge**: Expo Modules API (Kotlin)
- **Transfer engine**: Go (gomobile bindings)
- **Discovery**: UDP broadcast on port 9090
- **Transfer**: TCP on port 8080

## License

See [app/LICENSE](app/LICENSE).
