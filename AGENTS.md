# Offline P2P Transfer App — Development Plan

## Philosophy

This project is primarily for:

* learning networking by building
* experimenting with systems concepts
* enjoying programming
* gradually understanding mobile + low-level architecture

The goal is NOT:

* perfect architecture immediately
* enterprise-grade scalability
* production optimization from day 1

Avoid premature abstraction and overengineering.

---

# Core Product Vision

A nearby-device transfer app that:

* discovers nearby devices
* establishes direct peer-to-peer connections
* transfers files/apps reliably
* works in restrictive real-world environments

Examples:

* college WiFi
* hotspot-only situations
* no-router environments
* unstable local networks

Long-term:

* Android ↔ Android
* later desktop support
* eventually iOS support

---

# Chosen Stack

## Frontend

* Expo (prebuild workflow)
* TypeScript
* React Native

## Native Mobile

* Kotlin for Android-specific APIs
* Expo Modules API bridge

## Networking Core

* Go
* gomobile bindings later

## Initial Platforms

* Android only

---

# Important Architectural Principle

Separate:

* UI
* discovery
* connection setup
* transport
* protocol

DO NOT tightly couple them.

Desired architecture:

UI (Expo)
↓
Native module bridge
↓
Kotlin Android layer
↓
Discovery layer
(BLE / Nearby / Wi-Fi Direct)
↓
Connection setup
↓
Go transfer engine
↓
Transfer protocol
↓
Streams / sockets

Important:

The Go engine should NOT know:

* BLE exists
* Wi-Fi Direct exists
* Nearby Connections exists

The Go engine should only know:

* a connection was established
* bytes can be sent
* bytes can be received

---

# Development Rules

## Rule 1

Do not try to build the final architecture immediately.

## Rule 2

Each stage should produce something usable.

## Rule 3

Networking first.
Fancy UI later.

## Rule 4

Do not begin with discovery.

Reliable transfer comes before BLE, Nearby, or Wi-Fi Direct.

## Rule 5

The AI assistant should:

* guide
* explain
* review
* suggest improvements
* explain Android APIs when needed
* explain Kotlin concepts when needed

but should NOT fully autopilot implementation.

Learning > code generation.

---

# PHASE 1 — Pure Networking Sandbox

Goal:
Understand sockets and streams through experimentation.

## Tasks

* Create Go TCP server
* Create Go TCP client
* Send text messages
* Send small files
* Print transfer progress
* Handle disconnects badly at first
* Observe behavior

## Concepts Learned

* sockets
* TCP
* streams
* blocking vs concurrency
* goroutines
* buffers
* chunking

## Important

Do this on desktop FIRST.

No mobile yet.

---

# PHASE 2 — Basic Transfer Protocol

Goal:
Design a tiny custom protocol.

## Example Protocol

HELLO
START_TRANSFER
FILE_METADATA
CHUNK
END_TRANSFER

## Tasks

* Add metadata packets
* Add file size tracking
* Add chunked transfer
* Add transfer progress
* Add simple reconnect handling

## Avoid

* encryption
* compression
* optimization

for now.

---

# PHASE 3 — Android Integration

Goal:
Connect Go networking to mobile app.

## Tasks

* Create Expo prebuild project
* Create local Expo native module
* Call simple Kotlin function from JS
* Understand native bridge flow

THEN:

* expose Go networking through Kotlin

## Important

Still no BLE.
Still no Nearby.
Still no Wi-Fi Direct.

Learn the bridge first.

---

# PHASE 4 — Mobile File Transfer

Goal:
Transfer files between Android devices manually.

## Tasks

* Manual connection setup
* Manual IP entry if needed
* Connect devices
* Send file
* Show progress in UI

This is a HUGE milestone.

Even if ugly.

Success criteria:

"One file reliably transferred between two Android devices."

---

# PHASE 5 — LAN Discovery (UDP)

Goal:
Remove manual IP entry by discovering peers on the same Wi-Fi network.

## UDP Broadcast/Multicast

Learn:
* UDP networking in Go
* Broadcasting packets to local subnet
* Listening for UDP announcements
* Extracting IPs from UDP payloads

Goal:
Devices automatically see each other when connected to the same router/LAN.

# PHASE 6 — Better Reliability & Protocol Strengthening

## Add

* resumable transfers
* retry logic
* chunk verification
* SHA-256 verification
* reconnect handling
* transfer state machine
* UI progress bars via callbacks

---

# PHASE 8 — Better Transport

## Explore

* Wi-Fi Direct improvements
* hotspot fallback
* transport auto-selection
* multiple connection strategies

Only after reliability is solved.

---

# PHASE 9 — Cross Platform Expansion

After Android architecture stabilizes:

## Possible targets

* Windows
* Linux
* macOS
* eventually iOS

Reuse Go transfer engine.

---

# Responsibilities

## Kotlin Owns

* BLE
* Wi-Fi Direct
* Android permissions
* Android lifecycle
* discovery
* connection establishment

## Go Owns

* transfer protocol
* chunking
* streaming
* retries
* file verification
* transfer state
* progress tracking

Keep this boundary clean.

---

# What The AI Assistant SHOULD Help With

* architecture reviews
* debugging
* networking explanations
* protocol design feedback
* code review
* Kotlin explanations
* Android API explanations
* Expo bridge setup
* Go concurrency patterns
* identifying overengineering

## Important

Code review should focus on:

* explaining issues
* explaining alternatives
* explaining tradeoffs

Not rewriting entire files.

Learning remains the primary goal.

---

# What The AI Assistant SHOULD NOT Do

* generate entire project blindly
* rewrite architecture constantly
* add unnecessary abstractions
* introduce trendy tech without reason
* optimize too early
* hide complexity behind magic solutions

---

# Success Criteria

Success is NOT:

* becoming a SHAREit competitor

Success IS:

* understanding networking better
* understanding Android internals better
* learning Kotlin
* learning systems concepts
* building something real
* shipping progressively more capable versions

---

# First Concrete Milestone

The first TRUE success milestone is:

"Send one file reliably between two devices."

Nothing else matters before that.

Not BLE.
Not Wi-Fi Direct.
Not Nearby.
Not encryption.

Reliable transfer first.

---

# Important Reminder

Every networking app eventually becomes:

* state machines
* retries
* edge cases
* weird device behavior

Every Android app eventually becomes:

* permissions
* lifecycle issues
* callback chains
* OEM-specific weirdness

This is normal.

Do not interpret bugs as failure.

They ARE the learning process.
