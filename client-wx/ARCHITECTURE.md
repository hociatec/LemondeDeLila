# Architecture & Developer Guide - Le Monde de Lila (wxWidgets Client)

## 1. Overview & Architecture

`client-wx` is a C++20 wxWidgets native client for *Le Monde de Lila*.
The codebase is structured around Clean Architecture principles:

- **Domain Layer (`src/modules/*/domain`, `src/shared/domain`)**: Pure C++ domain models (`Session`, `OptionsState`), value types (`UserId`, `MessageId`), enums (`ProfileVisibility`), and interface definitions (`ISessionRepository`, `IOptionsRepository`). Free of UI framework dependencies.
- **Application Layer (`src/modules/*/application`)**: Use cases and state stores (`SessionStore`, `OptionsStore`, `ChatService`, `MessagingService`, `SocialService`). Coordinates domain logic and background tasks.
- **Infrastructure Layer (`src/modules/*/infrastructure`, `src/shared/network`, `src/shared/persistence`, `src/shared/security`)**: WinHTTP WebSockets, HTTP ticket providers, DPAPI credential protection, file persistence (`JsonFileStorage`, `AtomicFileWriter`), and network protocol parsers.
- **Presentation Layer (`src/modules/*/presentation`, `src/app`)**: wxWidgets views, frames, layout builders, event binders, and accessibility focus controllers.
- **Bootstrap Layer (`src/bootstrap`)**: Dependency injection container (`AppBootstrap`) assembling services, gateways, and UI frames.
- Runtime configuration is resolved through `shared/config/domain/AppConfig.*` with explicit environment-driven profiles (`LILA_BACKEND_PROFILE`, `LILA_BACKEND_API_WS`) rather than hard-coded per-machine edits.

---

## 2. Key Architecture Directives & Invariants

### 2.1 Concurrency & Background Execution
- All non-UI background tasks use `shared/concurrency/application/BackgroundExecutor.h` (`RunAsync`).
- Background worker threads operate on a bounded worker pool (`WorkerPool`) clamped between 2 and 8 threads, with a maximum queue capacity of 256 jobs to prevent memory bloat.
- Worker jobs accept a `std::stop_token` and check for cooperative cancellation.
- All exceptions inside background jobs are caught, converted into `AppError` or diagnostic logs, and safely marshaled.

### 2.2 Security & Session Storage
- Token persistence uses Windows DPAPI (`CryptProtectData` / `CryptUnprotectData`) via `shared/security/infrastructure/SecurityUtils.h`.
- Session access and refresh tokens in memory are erased upon destruction using `SecureWipeString`.
- Les événements WebSocket et champs de payload du client sont régénérés depuis
  `backend/src/platform/realtime/infrastructure/presentation/ws/ws-events.ts` et
  `backend/contracts/client-wx-fields.json`. La configuration CMake échoue si le
  backend local est présent mais que l'un de ces contrats manque.
- Local session storage files (`session.json`) have hardened file permissions (restricted ACLs under Windows / `0600` under POSIX) and are securely wiped before deletion.

### 2.3 Configuration & Preferences Boundaries
- User-facing preferences live in `OptionsState.general`, `.audio`, and `.chat`.
- Internal or operational knobs live under `OptionsState.internal` and are serialized separately from user preferences, with legacy compatibility preserved.
- Runtime metadata such as the running client version lives under `OptionsState.runtime` and is not mixed conceptually with user settings.

### 2.4 Object Ownership & Lifecycles
- `wxWidgets` controls and panels are owned by their parent `wxWindow` instances.
- Application services and stores are owned as `std::unique_ptr` by `AppBootstrap`.
- Callbacks and asynchronous operations must not capture raw UI widget pointers without lifetime validation.

### 2.5 Gameplay Presentation Boundaries
- `GamePlayPanel` is an orchestration shell: it connects session events, actions and the room focus flow.
- `presentation/confirmation` owns non-modal action confirmations; gameplay must not open action dialogs.
- `presentation/prompt` owns the inline configuration form, validation and its contained keyboard cycle.
- `presentation/hand` owns the vertical hand view and selection preservation.
- `presentation/info` converts game panels such as hands, scores and discard into display text.
- `presentation/shortcuts` resolves server shortcuts, action priority, key normalization and help text.
- New game-specific presentation behavior belongs in one of these focused components instead of growing `GamePlayPanel`.

---

## 3. Protocol & Network Architecture

- Realtime communication runs over WinHTTP WebSockets (`shared/network/infrastructure/websocket/WinHttpWebSocketClient`).
- Tickets are requested via authenticated HTTP endpoints before establishing WebSocket connections.
- JSON messages are validated strictly by the readers in `shared/data/json`.
- Realtime envelopes explicitly carry `protocolVersion` and `clientVersion`, and common payload parsing is centralized in `shared/network/application/realtime/RealtimePayloadReaders.h`.

---

## 4. Testing & Diagnostics

- **Structured Logging**: `lila::shared::logging::Log` outputs formatted timestamps, log levels (`Debug`, `Info`, `Warning`, `Error`), and categories to console and `client.log`.
- **Unit Testing**: `ctest --preset windows-vcpkg-debug` exécute tous les contrats réseau, session, options, gameplay, audio et mise à jour. Les grands scénarios sont découpés en segments sous `tests/network_protocol` et `tests/gameplay`.
- **Quality Tooling**: Optional CMake switches expose `clang-tidy`, `cppcheck`, `AddressSanitizer`, and compiler-supported sanitizer runs. See `QUALITY.md`.
- **Parser Hardening**: la cible `lemonde_de_lila_wx_parser_robustness_tests` rejoue un corpus versionné sur les entrées realtime, chat et UTF-8.

---

## 5. Administration native

- `src/modules/admin` owns the administration command catalog, application facade, gateways, and wxWidgets shell.
- `AdminCommandDialog` turns each command contract into a labelled business form; transport JSON is never edited directly by the administrator. `AdminFormMetadata` owns field labels, choices, multiline/list semantics, and optional-field behavior.
- `AdminResultFormatter` renders response objects and collections as readable records and lists instead of exposing raw transport JSON.
- The admin shell and its modal business forms enforce the same keyboard stack: Enter opens or validates, Escape pops one level, and multiline editors retain Enter for line breaks.
- The main menu exposes administration only when the current JWT contains `ROLE_ADMIN` or `admin`. This is a presentation policy only: backend guards remain authoritative.
- Admin API operations use the authenticated `/ws/api` client. Staff contact threads use a distinct authenticated client for `/ws/notify` and request tickets with scope `notify`.
- Full user CRUD, sounds, and maintenance use `AuthenticatedHttpClient`. It adds the bearer token, supports JSON and multipart bodies, bounds response sizes, and cooperates with cancellation.
- Maintenance's `x-admin-maintenance-token` is held only in the `AdminFrame` lifetime, wiped on exit, and is never persisted or logged.
- All commands run through `BackgroundExecutor`; completion is marshalled through `wxWeakRef` and rejected when its `AsyncRequestSlot` generation is stale.
- Destructive commands require both a warning and the explicit word `CONFIRMER`. Server responses are displayed in a read-only result region and are not copied to `client.log`.
- `AdminCommandCatalog.*.cpp` documents the effective response type when it differs from the request event (for example `admin.users.rolesUpdated` or refreshed category collections).
- `scripts/VerifyAdminClientCoverage.mjs` compares that catalog with every backend HTTP admin controller, registered `admin.*` WebSocket route, and staff-contact command. The test makes backend additions fail CI until the client mapping is updated.
