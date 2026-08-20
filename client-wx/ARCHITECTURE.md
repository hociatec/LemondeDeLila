# Architecture & Developer Guide - Le Monde de Lila (wxWidgets Client)

## 1. Overview & Architecture

`client-wx` is a C++20 wxWidgets native client for *Le Monde de Lila*.
The codebase is structured around Clean Architecture principles:

- **Domain Layer (`src/modules/*/domain`, `src/shared/domain`)**: Pure C++ domain models (`Session`, `OptionsState`), value types (`UserId`, `MessageId`), enums (`ProfileVisibility`), and interface definitions (`ISessionRepository`, `IOptionsRepository`). Free of UI framework dependencies.
- **Application Layer (`src/modules/*/application`)**: Use cases and state stores (`SessionStore`, `OptionsStore`, `ChatService`, `MessagingService`, `SocialService`). Coordinates domain logic and background tasks.
- **Infrastructure Layer (`src/modules/*/infrastructure`, `src/shared/network`, `src/shared/persistence`, `src/shared/security`)**: WinHTTP WebSockets, HTTP ticket providers, DPAPI credential protection, file persistence (`JsonFileStorage`, `AtomicFileWriter`), and network protocol parsers.
- **Presentation Layer (`src/modules/*/presentation`, `src/app`)**: wxWidgets views, frames, layout builders, event binders, and accessibility focus controllers.
- **Bootstrap Layer (`src/bootstrap`)**: Dependency injection container (`AppBootstrap`) assembling services, gateways, and UI frames.
- Runtime configuration is resolved through `shared/config/AppConfig.*` with explicit environment-driven profiles (`LILA_BACKEND_PROFILE`, `LILA_BACKEND_API_WS`) rather than hard-coded per-machine edits.

---

## 2. Key Architecture Directives & Invariants

### 2.1 Concurrency & Background Execution
- All non-UI background tasks use `shared/concurrency/BackgroundExecutor.h` (`RunAsync`).
- Background worker threads operate on a bounded worker pool (`WorkerPool`) clamped between 2 and 8 threads, with a maximum queue capacity of 256 jobs to prevent memory bloat.
- Worker jobs accept a `std::stop_token` and check for cooperative cancellation.
- All exceptions inside background jobs are caught, converted into `AppError` or diagnostic logs, and safely marshaled.

### 2.2 Security & Session Storage
- Token persistence uses Windows DPAPI (`CryptProtectData` / `CryptUnprotectData`) via `shared/security/SecurityUtils.h`.
- Session access and refresh tokens in memory are erased upon destruction using `SecureWipeString`.
- Local session storage files (`session.json`) have hardened file permissions (restricted ACLs under Windows / `0600` under POSIX) and are securely wiped before deletion.

### 2.3 Configuration & Preferences Boundaries
- User-facing preferences live in `OptionsState.general`, `.audio`, and `.chat`.
- Internal or operational knobs live under `OptionsState.internal` and are serialized separately from user preferences, with legacy compatibility preserved.
- Runtime metadata such as the running client version lives under `OptionsState.runtime` and is not mixed conceptually with user settings.

### 2.4 Object Ownership & Lifecycles
- `wxWidgets` controls and panels are owned by their parent `wxWindow` instances.
- Application services and stores are owned as `std::unique_ptr` by `AppBootstrap`.
- Callbacks and asynchronous operations must not capture raw UI widget pointers without lifetime validation.

---

## 3. Protocol & Network Architecture

- Realtime communication runs over WinHTTP WebSockets (`shared/network/websocket/WinHttpWebSocketClient`).
- Tickets are requested via authenticated HTTP endpoints before establishing WebSocket connections.
- JSON messages are validated strictly using `shared/data/JsonApiHelpers.h` (`EnsureArrayStrict`, `ReadStrictTimestamp`).
- Realtime envelopes explicitly carry `protocolVersion` and `clientVersion`, and common payload parsing is centralized in `shared/network/realtime/RealtimePayloadReaders.h`.

---

## 4. Testing & Diagnostics

- **Structured Logging**: `lila::shared::logging::Log` outputs formatted timestamps, log levels (`Debug`, `Info`, `Warning`, `Error`), and categories to console and `client.log`.
- **Unit Testing**: Run unit tests with `NetworkProtocolTests.cpp` covering session validation, options schema migrations, atomic writes, domain types, and security memory wiping.
- **Quality Tooling**: Optional CMake switches expose `clang-tidy`, `cppcheck`, `AddressSanitizer`, and compiler-supported sanitizer runs. See `QUALITY.md`.
- **Parser Hardening**: A dedicated parser fuzz harness target exists for realtime/chat/UTF-8 entry points.
