#include <algorithm>
#include <atomic>
#include <iostream>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <future>
#include <chrono>
#include <deque>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <stdexcept>
#include <string>
#include <unordered_set>
#include <vector>

#include <wx/init.h>
#include "modules/audio/application/AudioService.h"
#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/audio/application/IAudioSettingsProvider.h"
#include "modules/audio/application/SoundVolumeResolver.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/application/ChatMessageStore.h"
#include "modules/chat/application/IChatGateway.h"
#include "modules/chat/domain/ChatMessage.h"
#include "modules/chat/domain/ChatState.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/presentation/ChatMessageActions.h"
#include "modules/catalog/infrastructure/CatalogPayloadCodec.h"
#include "modules/catalog/presentation/CatalogShelfNavigator.h"
#include "modules/storybook/infrastructure/StoryBookPayloadCodec.h"
#include "modules/storybook/presentation/StoryBookNavigator.h"
#include "modules/leaderboard/infrastructure/LeaderboardPayloadCodec.h"
#include "modules/leaderboard/presentation/LeaderboardNavigator.h"
#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/rooms/infrastructure/RoomSessionGateway.h"
#include "modules/rooms/application/IRoomSessionGateway.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/presentation/RoomLobbyNavigator.h"
#include "modules/rooms/presentation/RoomOpenRequest.h"
#include "modules/rooms/presentation/RoomPresentationModel.h"
#include "modules/rooms/presentation/RoomShortcutPolicy.h"
#include "modules/vault/infrastructure/VaultPayloadCodec.h"
#include "modules/vault/presentation/VaultNavigator.h"
#include "modules/vault/presentation/VaultPresentationModel.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/domain/IOptionsRepository.h"
#include "modules/options/domain/OptionsState.h"
#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/ISessionRepository.h"
#include "modules/session/domain/Session.h"
#include "shared/accessibility/presentation/ActionButton.h"
#include "shared/cache/application/SingleFlightCache.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/concurrency/application/AsyncRequestSlot.h"
#include "shared/accessibility/application/NavigationController.h"
#include "modules/audio/domain/SoundCatalog.h"
#include "modules/audio/infrastructure/LocalSoundManifest.h"
#include "modules/audio/presentation/SoundOptionsCatalog.h"
#include "shared/domain/identifiers/DomainTypes.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/persistence/infrastructure/AtomicFileWriter.h"
#include "shared/persistence/infrastructure/JsonFileStorage.h"
#include "shared/security/domain/JwtPayload.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace
{
void Expect(bool condition, const char* message)
{
    if (!condition)
    {
        throw std::runtime_error(message);
    }
}

template <typename TPredicate>
void WaitUntil(TPredicate&& predicate, const char* failureMessage, int timeoutMs = 3000)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
    while (std::chrono::steady_clock::now() < deadline)
    {
        if (predicate())
        {
            return;
        }

        std::this_thread::sleep_for(std::chrono::milliseconds(20));
    }

    Expect(false, failureMessage);
}

class InMemorySessionRepository final : public lila::modules::session::domain::ISessionRepository
{
public:
    [[nodiscard]] std::optional<lila::modules::session::domain::Session> Load() const override
    {
        return session_;
    }

    void Save(const lila::modules::session::domain::Session& session) override
    {
        session_ = session;
    }

    void Clear() override
    {
        session_.reset();
    }

private:
    std::optional<lila::modules::session::domain::Session> session_;
};

class BlockingSessionRefresher final
    : public lila::modules::session::application::ISessionRefresher
{
public:
    [[nodiscard]] lila::modules::session::application::SessionRefreshResult Refresh(
        const std::string&,
        std::stop_token stopToken) override
    {
        {
            std::scoped_lock lock(mutex_);
            started_ = true;
        }
        condition_.notify_all();

        std::unique_lock lock(mutex_);
        std::stop_callback cancelWait(stopToken, [this]() { condition_.notify_all(); });
        condition_.wait(lock, [this, stopToken]() {
            return released_ || stopToken.stop_requested();
        });
        if (stopToken.stop_requested())
        {
            return {};
        }

        lila::modules::session::application::SessionRefreshResult result;
        result.success = true;
        result.token = "new-header.new-payload.new-signature";
        result.refreshToken = "rotated-refresh-token";
        result.expiresAt = 4102444800LL;
        return result;
    }

    [[nodiscard]] bool Revoke(
        const std::string& refreshToken,
        std::stop_token = {}) override
    {
        std::scoped_lock lock(mutex_);
        revokedTokens_.push_back(refreshToken);
        return true;
    }

    void WaitUntilStarted()
    {
        std::unique_lock lock(mutex_);
        if (!condition_.wait_for(
                lock,
                std::chrono::seconds(2),
                [this]() { return started_; }))
        {
            throw std::runtime_error("Timed out waiting for session refresh.");
        }
    }

    void Release()
    {
        {
            std::scoped_lock lock(mutex_);
            released_ = true;
        }
        condition_.notify_all();
    }

    [[nodiscard]] bool WasRevoked(const std::string& refreshToken) const
    {
        std::scoped_lock lock(mutex_);
        return std::find(revokedTokens_.begin(), revokedTokens_.end(), refreshToken)
            != revokedTokens_.end();
    }

private:
    mutable std::mutex mutex_;
    std::condition_variable condition_;
    bool started_ = false;
    bool released_ = false;
    std::vector<std::string> revokedTokens_;
};

class InMemoryOptionsRepository final : public lila::modules::options::domain::IOptionsRepository
{
public:
    [[nodiscard]] lila::modules::options::domain::OptionsState Load() const override
    {
        return state_;
    }

    void Save(const lila::modules::options::domain::OptionsState& state) const override
    {
        state_ = state;
    }

private:
    mutable lila::modules::options::domain::OptionsState state_;
};

class FakeAudioService final : public lila::modules::audio::application::IAudioService
{
public:
    void Play(lila::modules::audio::domain::SoundCue cue) override
    {
        playedCues.push_back(cue);
    }

    void StartLoop(lila::modules::audio::domain::SoundCue cue) override
    {
        playedCues.push_back(cue);
    }

    void StopLoop() override {}

    void SetBackground(lila::modules::audio::domain::AudioBackground background) override
    {
        currentBackground = background;
    }

    void StopAll() override {}
    void ShutdownImmediately() override {}

    std::vector<lila::modules::audio::domain::SoundCue> playedCues;
    lila::modules::audio::domain::AudioBackground currentBackground =
        lila::modules::audio::domain::AudioBackground::None;
};

class FixedAudioSettingsProvider final
    : public lila::modules::audio::application::IAudioSettingsProvider
{
public:
    [[nodiscard]] lila::modules::audio::application::AudioSettings Snapshot() const override
    {
        return settings;
    }

    lila::modules::audio::application::AudioSettings settings;
};

class RecordingAudioBackend final : public lila::modules::audio::application::IAudioBackend
{
public:
    void Preload(lila::modules::audio::domain::SoundCue cue) override
    {
        preloaded.push_back(cue);
    }

    void Play(lila::modules::audio::domain::SoundCue cue, float volume) override
    {
        played.emplace_back(cue, volume);
    }

    void SetLoop(
        std::optional<lila::modules::audio::domain::SoundCue> cue,
        float volume) override
    {
        loops.emplace_back(cue, volume);
    }

    void StopAll() override { ++stopCount; }
    void InterruptPlayback() noexcept override { ++interruptCount; }
    void Shutdown() noexcept override { ++shutdownCount; }

    std::vector<lila::modules::audio::domain::SoundCue> preloaded;
    std::vector<std::pair<lila::modules::audio::domain::SoundCue, float>> played;
    std::vector<std::pair<std::optional<lila::modules::audio::domain::SoundCue>, float>> loops;
    int stopCount = 0;
    int interruptCount = 0;
    int shutdownCount = 0;
};

class FakeRoomTicketProvider final : public lila::shared::network::http::IWsTicketProvider
{
public:
    [[nodiscard]] std::string GetTicket(
        const std::string& scope,
        const std::string& bearerToken) const override
    {
        requestedScope = scope;
        requestedBearerToken = bearerToken;
        return "room-ticket";
    }

    mutable std::string requestedScope;
    mutable std::string requestedBearerToken;
};

class FakeRoomWebSocketClient final : public lila::shared::network::websocket::IWebSocketClient
{
public:
    void Connect(
        const std::string& value,
        const lila::shared::network::websocket::WebSocketHeaders& valueHeaders,
        std::stop_token = {}) override
    {
        endpoint = value;
        headers = valueHeaders;
        connected = true;
    }

    void Close() override { connected = false; }
    void CancelPendingOperation() noexcept override { connected = false; }
    [[nodiscard]] bool IsConnected() const override { return connected; }
    [[nodiscard]] bool IsConnectedTo(
        const std::string& value,
        const lila::shared::network::websocket::WebSocketHeaders& valueHeaders) const override
    {
        return connected && endpoint == value && headers == valueHeaders;
    }
    void Send(const std::string& payload) override
    {
        {
            std::scoped_lock lock(ioMutex);
            sentPayloads.push_back(payload);
        }
        sentCondition.notify_all();
    }
    [[nodiscard]] std::string Receive() override
    {
        std::scoped_lock lock(ioMutex);
        if (responses.empty()) throw std::runtime_error("No fake room response.");
        auto response = std::move(responses.front());
        responses.pop_front();
        return response;
    }

    void QueueResponse(std::string response)
    {
        std::scoped_lock lock(ioMutex);
        responses.push_back(std::move(response));
    }

    [[nodiscard]] std::string WaitForSentPayload(std::size_t count)
    {
        std::unique_lock lock(ioMutex);
        if (!sentCondition.wait_for(
                lock,
                std::chrono::seconds(1),
                [this, count]() { return sentPayloads.size() >= count; }))
            throw std::runtime_error("Timed out waiting for fake room command.");
        return sentPayloads.at(count - 1);
    }
    [[nodiscard]] std::string SendAndReceive(
        const std::string&,
        const std::string&,
        const lila::shared::network::websocket::WebSocketHeaders&,
        std::stop_token) override
    {
        throw std::runtime_error("Unexpected SendAndReceive call.");
    }

    bool connected = false;
    std::string endpoint;
    lila::shared::network::websocket::WebSocketHeaders headers;
    std::vector<std::string> sentPayloads;
    std::deque<std::string> responses;
    std::mutex ioMutex;
    std::condition_variable sentCondition;
};

class FakeRoomSessionGateway final : public lila::modules::rooms::application::IRoomSessionGateway
{
public:
    FakeRoomSessionGateway()
    {
        room.id = 42;
        room.name = "Table d'Alice";
        room.gameType = "four-winds";
        room.gameName = "Les quatre vents";
        room.status = "started";
        room.minPlayers = 2;
        room.maxPlayers = 4;
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomState Create(
        std::string_view,
        std::stop_token) override
    {
        Activate();
        return room;
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomState Join(
        int,
        bool,
        std::stop_token) override
    {
        Activate();
        return room;
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomState Reconnect(std::stop_token) override
    {
        {
            std::scoped_lock lock(mutex);
            ++reconnectCount;
            active = true;
            interrupted = false;
        }
        condition.notify_all();
        return room;
    }

    void Execute(
        const lila::modules::rooms::domain::RoomCommandRequest& request,
        std::stop_token) override
    {
        if (request.command == lila::modules::rooms::domain::RoomCommand::Ping)
        {
            std::scoped_lock lock(mutex);
            ++pingCount;
        }
    }

    [[nodiscard]] lila::modules::rooms::domain::RoomEvent ReceiveEvent(std::stop_token stopToken) override
    {
        std::unique_lock lock(mutex);
        condition.wait(lock, [this, stopToken]()
        {
            return stopToken.stop_requested() || interrupted || !events.empty();
        });
        if (stopToken.stop_requested()) return {};
        if (interrupted)
        {
            interrupted = false;
            throw std::runtime_error("socket lost");
        }
        auto event = std::move(events.front());
        events.pop_front();
        return event;
    }

    void Interrupt() override
    {
        {
            std::scoped_lock lock(mutex);
            interrupted = true;
        }
        condition.notify_all();
    }

    void Leave() override { Close(); }

    void Close() override
    {
        {
            std::scoped_lock lock(mutex);
            active = false;
            interrupted = true;
        }
        condition.notify_all();
    }

    void TriggerReceiveFailure() { Interrupt(); }

    void Activate()
    {
        std::scoped_lock lock(mutex);
        active = true;
        interrupted = false;
    }

    lila::modules::rooms::domain::RoomState room;
    std::mutex mutex;
    std::condition_variable condition;
    std::deque<lila::modules::rooms::domain::RoomEvent> events;
    int reconnectCount = 0;
    int pingCount = 0;
    bool active = false;
    bool interrupted = false;
};

class FakeChatProtocol final : public lila::modules::chat::infrastructure::IChatProtocol
{
public:
    [[nodiscard]] std::string BuildSendPayload(const std::string& text) const override
    {
        return "send:" + text;
    }

    [[nodiscard]] std::string BuildEditPayload(const std::string& messageId, const std::string& text) const override
    {
        return "edit:" + messageId + ":" + text;
    }

    [[nodiscard]] std::string BuildDeletePayload(const std::string& messageId) const override
    {
        return "delete:" + messageId;
    }

    [[nodiscard]] lila::modules::chat::infrastructure::ChatEvent ParseEvent(
        const std::string& rawJson,
        int currentUserId,
        std::time_t nowUtc) const override
    {
        using namespace lila::modules::chat;

        infrastructure::ChatEvent event;
        if (rawJson == "history")
        {
            event.type = infrastructure::ChatEventType::History;
            event.editWindowSeconds = 30;

            domain::ChatMessage message;
            message.id = "m1";
            message.userId = currentUserId;
            message.user = "alice";
            message.text = "bonjour";
            message.timestampUtc = nowUtc;
            message.isMine = true;
            event.messages.push_back(std::move(message));
            return event;
        }

        if (rawJson == "history-2")
        {
            event.type = infrastructure::ChatEventType::History;
            event.editWindowSeconds = 15;

            domain::ChatMessage message;
            message.id = "m2";
            message.userId = currentUserId;
            message.user = "alice";
            message.text = "reconnecte";
            message.timestampUtc = nowUtc;
            message.isMine = true;
            event.messages.push_back(std::move(message));
            return event;
        }

        if (rawJson == "server-error")
        {
            event.type = infrastructure::ChatEventType::Error;
            event.error = domain::ChatServerError{"Erreur chat", "server", std::nullopt};
            return event;
        }

        event.type = infrastructure::ChatEventType::Ignored;
        return event;
    }
};

class FakeChatGateway final : public lila::modules::chat::application::IChatGateway
{
public:
    struct ReceiveStep
    {
        bool throws = false;
        std::string value;
    };

    void Open(const std::string&, const std::string&) override
    {
        std::lock_guard lock(mutex_);
        ++openCount;
        if (!openFailures.empty())
        {
            const bool shouldFail = openFailures.front();
            openFailures.pop_front();
            if (shouldFail)
            {
                throw std::runtime_error("open failed");
            }
        }
    }

    void Close() override
    {
        std::lock_guard lock(mutex_);
        ++closeCount;
    }

    void Interrupt() override
    {
        {
            std::lock_guard lock(mutex_);
            ++interruptCount;
            interrupted = true;
        }
        condition_.notify_all();
    }

    void Send(const std::string& payload) override
    {
        std::lock_guard lock(mutex_);
        ++sendCount;
        lastSentPayload = payload;
        if (sendShouldThrow)
        {
            throw std::runtime_error("send failed");
        }
    }

    [[nodiscard]] std::string Receive() override
    {
        std::unique_lock lock(mutex_);
        condition_.wait(lock, [this]() { return interrupted || !receiveSteps.empty(); });

        if (interrupted)
        {
            interrupted = false;
            throw std::runtime_error("interrupted");
        }

        const ReceiveStep step = receiveSteps.front();
        receiveSteps.pop_front();
        if (step.throws)
        {
            throw std::runtime_error(step.value);
        }

        return step.value;
    }

    std::mutex mutex_;
    std::condition_variable condition_;
    std::deque<ReceiveStep> receiveSteps;
    std::deque<bool> openFailures;
    int openCount = 0;
    int closeCount = 0;
    int interruptCount = 0;
    int sendCount = 0;
    bool sendShouldThrow = false;
    bool interrupted = false;
    std::string lastSentPayload;
};
}

void TestSessionValidation()
{
    lila::modules::session::domain::Session session;
    Expect(!session.IsAuthenticated(), "Session vide ne doit pas etre authentifiee");

    session.userId = lila::shared::domain::UserId{42};
    session.username = "testuser";
    session.token = "invalid-token";
    Expect(!session.IsAuthenticated(), "Token invalide ne doit pas etre accepte");

    session.token = "header.payload.signature";
    Expect(session.IsAuthenticated(), "Token JWT structurellement valide attendu");

    session.expiresAt = 1000;
    Expect(!session.IsAuthenticated(), "Session expiree ne doit pas etre authentifiee");

    session.expiresAt = 4102444800LL;
    Expect(session.IsAuthenticated(), "Session future doit rester authentifiee");

    std::cout << "[TEST PASSED] SessionValidation\n";
}

void TestJwtPayloadExpiration()
{
    const std::string valid =
        "header.eyJ1c2VybmFtZSI6ImFsaWNlIiwiaWQiOjcsImV4cCI6NDEwMjQ0NDgwMH0.signature";
    Expect(
        lila::shared::security::ReadJwtExpiration(valid) == 4102444800LL,
        "Expiration JWT attendue");

    bool rejected = false;
    try
    {
        static_cast<void>(lila::shared::security::ReadJwtExpiration("header.payload.signature"));
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    Expect(rejected, "Payload JWT invalide devait etre refuse");
    std::cout << "[TEST PASSED] JwtPayloadExpiration\n";
}

void TestOptionsStateNormalization()
{
    lila::modules::options::domain::OptionsState options;
    options.audio.soundAmbienceVolume = 150;
    options.internal.admin.adminChatModerationLoadLimit = -5;
    options.Normalize();

    Expect(options.audio.soundAmbienceVolume == 100, "Volume ambiance doit etre borne a 100");
    Expect(options.internal.admin.adminChatModerationLoadLimit == 1, "Limite moderation doit etre bornee a 1");
    Expect(
        options.schemaVersion == lila::modules::options::domain::OptionsState::SchemaVersion,
        "Schema version par defaut inattendue");

    std::cout << "[TEST PASSED] OptionsStateNormalization\n";
}

void TestDomainTypes()
{
    lila::shared::domain::UserId id1{100};
    lila::shared::domain::UserId id2{100};
    lila::shared::domain::UserId id3{200};

    Expect(id1 == id2, "UserId egaux attendus");
    Expect(id1 != id3, "UserId differents attendus");
    Expect(id1.IsValid(), "UserId positif attendu valide");

    Expect(
        lila::shared::domain::ProfileVisibilityFromString("friends") == lila::shared::domain::ProfileVisibility::Friends,
        "Mapping friends invalide");
    Expect(
        std::string(lila::shared::domain::ProfileVisibilityToString(lila::shared::domain::ProfileVisibility::Private)) == "private",
        "Mapping private invalide");

    std::cout << "[TEST PASSED] DomainTypes\n";
}

void TestSecurityWipe()
{
    std::string secret = "SensitivePassword123";
    lila::shared::security::SecureWipeString(secret);
    Expect(secret.empty(), "SecureWipeString doit vider la chaine");

    std::cout << "[TEST PASSED] SecurityWipe\n";
}

void TestJsonFileStorageRejectsOversizedFiles()
{
    const std::filesystem::path path = std::filesystem::current_path() / "oversized-test.json";
    {
        std::ofstream file(path, std::ios::binary | std::ios::trunc);
        const std::vector<char> data((1024 * 1024) + 1, 'x');
        file.write(data.data(), static_cast<std::streamsize>(data.size()));
    }

    nlohmann::json content;
    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::persistence::JsonFileStorage::ReadIfExists(path, content));
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()) == lila::shared::errors::JsonFileTooLarge, "JsonFileTooLarge attendu");
    }

    std::filesystem::remove(path);
    Expect(threw, "Lecture fichier JSON surdimensionne devait echouer");

    std::cout << "[TEST PASSED] JsonFileStorageRejectsOversizedFiles\n";
}

void TestJsonFileStorageRejectsCorruptedFiles()
{
    const std::filesystem::path path = std::filesystem::current_path() / "corrupted-test.json";
    {
        std::ofstream file(path, std::ios::binary | std::ios::trunc);
        file << "{ invalid json";
    }

    nlohmann::json content;
    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::persistence::JsonFileStorage::ReadIfExists(path, content));
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()).find(lila::shared::errors::CorruptedJsonFile) != std::string::npos, "CorruptedJsonFile attendu");
    }

    std::filesystem::remove(path);
    Expect(threw, "Lecture fichier corrompu devait echouer");

    std::cout << "[TEST PASSED] JsonFileStorageRejectsCorruptedFiles\n";
}

void TestOptionsCodecMigratesLegacyFieldsAndSchema()
{
    const nlohmann::json legacyDocument = {
        {"confirmLogout", true},
        {"muteAll", true},
        {"schemaVersion", 1},
        {"currentVersion", "1.2.3"}
    };

    const auto state = lila::modules::options::infrastructure::json::Parse(legacyDocument);
    Expect(state.confirmExit, "confirmExit migre attendu");
    Expect(state.repairBrokenAccents, "repairBrokenAccents doit etre actif par defaut");
    Expect(state.muteAll, "muteAll migre attendu");
    Expect(state.runtime.currentVersion == std::optional<std::string>("1.2.3"), "currentVersion migree attendue");
    Expect(
        state.schemaVersion == lila::modules::options::domain::OptionsState::SchemaVersion,
        "Schema version migree invalide");

    const auto serialized = lila::modules::options::infrastructure::json::Serialize(state);
    Expect(
        serialized.at("schemaVersion") == lila::modules::options::domain::OptionsState::SchemaVersion,
        "Schema serialise invalide");
    Expect(serialized.at("general").at("confirmExit") == true, "confirmExit serialise attendu");
    Expect(serialized.at("general").at("repairBrokenAccents") == true, "repairBrokenAccents serialise attendu");
    Expect(!serialized.contains("confirmLogout"), "confirmLogout legacy ne doit plus etre serialise");
    Expect(serialized.at("currentVersion") == "1.2.3", "currentVersion top-level attendue");
    Expect(serialized.at("runtime").at("currentVersion") == "1.2.3", "currentVersion runtime attendue");
    Expect(
        serialized.at("internal").at("admin").at("adminChatModerationLoadLimit") == 200,
        "Limite admin serialisee inattendue");

    std::cout << "[TEST PASSED] OptionsCodecMigratesLegacyFieldsAndSchema\n";
}

void TestSoundCatalogAndPerCueOptionsRoundTrip()
{
    const auto catalog = lila::modules::audio::domain::GetSoundCatalog();
    const auto options = lila::modules::audio::presentation::GetSoundOptions();
    Expect(
        catalog.size() == static_cast<std::size_t>(lila::modules::audio::domain::SoundCue::Count),
        "Tous les sons doivent etre presents dans le catalogue");
    Expect(options.size() == catalog.size(), "Chaque son doit avoir un libelle d'option");

    std::unordered_set<std::string> keys;
    for (std::size_t index = 0; index < catalog.size(); ++index)
    {
        const auto& descriptor = catalog[index];
        Expect(keys.insert(std::string(descriptor.key)).second, "Cle de son dupliquee");
        Expect(options[index].cue == descriptor.cue, "Ordre du catalogue d'options invalide");
        Expect(!options[index].label.empty(), "Libelle de son requis");
        const auto fileName = lila::modules::audio::infrastructure::GetLocalSoundFile(descriptor.cue);
        Expect(!fileName.empty(), "Fichier sonore de repli requis");
        Expect(
            std::filesystem::exists(std::filesystem::current_path() / "resources" / "sounds" / fileName),
            "Fichier sonore ou fichier de repli manquant");
    }

    lila::modules::options::domain::OptionsState state;
    state.audio.cues["clientConnected"] = {false, 37};
    state.audio.cues["tableAmbience20"] = {true, 72};
    const auto parsed = lila::modules::options::infrastructure::json::Parse(
        lila::modules::options::infrastructure::json::Serialize(state));
    Expect(!parsed.audio.cues.at("clientConnected").enabled, "Activation individuelle non conservee");
    Expect(parsed.audio.cues.at("clientConnected").volume == 37, "Volume individuel non conserve");
    Expect(parsed.audio.cues.at("tableAmbience20").volume == 72, "Volume ambiance de table non conserve");

    auto normalized = parsed;
    normalized.audio.cues.at("clientConnected").volume = 500;
    normalized.Normalize();
    Expect(normalized.audio.cues.at("clientConnected").volume == 100, "Volume individuel non borne");

    std::cout << "[TEST PASSED] SoundCatalogAndPerCueOptionsRoundTrip\n";
}

void TestAudioSettingsAndServiceRouting()
{
    using namespace lila::modules::audio;
    FixedAudioSettingsProvider settings;
    settings.settings.ambienceVolume = 30;
    settings.settings.splitAmbienceVolume = false;
    settings.settings.cues[static_cast<std::size_t>(domain::SoundCue::MainMenuMusic)] = {true, 50};

    const auto* menu = domain::FindSoundDescriptor(domain::SoundCue::MainMenuMusic);
    Expect(menu != nullptr, "Son du menu attendu");
    const auto commonVolume = application::ResolvePlaybackSettings(*menu, settings.settings);
    Expect(commonVolume.enabled && commonVolume.volume > 0.149F && commonVolume.volume < 0.151F,
        "Volume ambiance commun et individuel attendu");

    settings.settings.splitAmbienceVolume = true;
    settings.settings.menuAmbienceVolume = 80;
    const auto splitVolume = application::ResolvePlaybackSettings(*menu, settings.settings);
    Expect(splitVolume.volume > 0.399F && splitVolume.volume < 0.401F,
        "Volume ambiance menu separe attendu");

    RecordingAudioBackend backend;
    application::AudioService service(backend, settings);
    Expect(backend.preloaded.size() == 8, "Prechauffage des sons courants attendu");

    service.Play(domain::SoundCue::Navigation);
    Expect(backend.played.size() == 1 && backend.played.front().first == domain::SoundCue::Navigation,
        "Routage du son de navigation attendu");
    service.SetBackground(domain::AudioBackground::MainMenu);
    Expect(backend.loops.size() == 1 &&
        backend.loops.front().first == domain::SoundCue::MainMenuMusic,
        "Routage de l'ambiance menu attendu");
    settings.settings.tableAmbienceVolume = 20;
    service.StartLoop(domain::SoundCue::TableAmbience20);
    Expect(backend.loops.back().first == domain::SoundCue::TableAmbience20,
        "Toutes les ambiances de table doivent pouvoir etre lancees");

    settings.settings.muteAll = true;
    service.Play(domain::SoundCue::Selection);
    Expect(backend.played.size() == 1, "Aucun son ne doit etre joue en mode muet");
    service.SetBackground(domain::AudioBackground::Tavern);
    Expect(!backend.loops.back().first.has_value(), "L'ambiance doit etre arretee en mode muet");

    service.ShutdownImmediately();
    service.Play(domain::SoundCue::Navigation);
    Expect(backend.interruptCount == 1 && backend.shutdownCount == 1,
        "Arret immediat et liberation du moteur attendus");
    Expect(backend.played.size() == 1, "Aucune lecture ne doit suivre l'arret audio");

    std::cout << "[TEST PASSED] AudioSettingsAndServiceRouting\n";
}

void TestSessionClearWipesRefreshToken()
{
    lila::modules::session::domain::Session session;
    session.token = "header.payload.signature";
    session.refreshToken = "refresh-token";
    session.ClearSecret();

    Expect(session.token.empty(), "Access token doit etre efface");
    Expect(session.refreshToken.empty(), "Refresh token doit etre efface");

    std::cout << "[TEST PASSED] SessionClearWipesRefreshToken\n";
}

void TestSessionMovePreservesSecrets()
{
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.refreshToken = "refresh-token";
    session.expiresAt = 4102444800LL;

    lila::modules::session::domain::Session moved(std::move(session));

    Expect(moved.userId == lila::shared::domain::UserId{42}, "UserId deplace attendu");
    Expect(moved.username == "alice", "Username deplace attendu");
    Expect(moved.token == "header.payload.signature", "Token deplace attendu");
    Expect(moved.refreshToken == "refresh-token", "Refresh token deplace attendu");
    Expect(moved.expiresAt == 4102444800LL, "Expiration deplacee attendue");
    Expect(session.token.empty(), "Source deplacee: token doit etre efface");
    Expect(session.refreshToken.empty(), "Source deplacee: refresh token doit etre efface");

    std::cout << "[TEST PASSED] SessionMovePreservesSecrets\n";
}

void TestSessionStoreRestoreLoadsPersistedSession()
{
    auto repository = std::make_unique<InMemorySessionRepository>();

    lila::modules::session::domain::Session persisted;
    persisted.userId = lila::shared::domain::UserId{7};
    persisted.username = "restored-user";
    persisted.token = "header.payload.signature";
    persisted.refreshToken = "refresh-token";
    persisted.expiresAt = 4102444800LL;
    repository->Save(persisted);

    lila::modules::session::application::SessionStore sessionStore(std::move(repository));
    Expect(sessionStore.Restore(), "La restauration de session devait reussir");
    Expect(sessionStore.HasActiveSession(), "Une session active restauree etait attendue");
    Expect(sessionStore.Current().username == "restored-user", "Username restaure attendu");
    Expect(sessionStore.Current().token == "header.payload.signature", "Token restaure attendu");
    Expect(sessionStore.IsPersistent(), "La session restauree devait etre marquee persistante");

    std::cout << "[TEST PASSED] SessionStoreRestoreLoadsPersistedSession\n";
}

void TestSessionStoreRejectsSupersededConcurrentRefresh()
{
    auto refresher = std::make_unique<BlockingSessionRefresher>();
    auto* refresherProbe = refresher.get();
    lila::modules::session::application::SessionStore sessionStore(
        std::make_unique<InMemorySessionRepository>(),
        std::move(refresher));

    lila::modules::session::domain::Session firstSession;
    firstSession.userId = lila::shared::domain::UserId{1};
    firstSession.username = "first-user";
    firstSession.token = "old-header.old-payload.old-signature";
    firstSession.refreshToken = "old-refresh-token";
    firstSession.expiresAt = 1;
    sessionStore.Open(std::move(firstSession), false);

    auto refresh = std::async(
        std::launch::async,
        [&sessionStore]() { return sessionStore.RefreshAccessToken(); });
    refresherProbe->WaitUntilStarted();

    sessionStore.Clear();
    lila::modules::session::domain::Session secondSession;
    secondSession.userId = lila::shared::domain::UserId{2};
    secondSession.username = "second-user";
    secondSession.token = "second-header.second-payload.second-signature";
    secondSession.refreshToken = "second-refresh-token";
    secondSession.expiresAt = 4102444800LL;
    sessionStore.Open(std::move(secondSession), false);
    refresherProbe->Release();

    bool supersededRefreshRejected = false;
    try
    {
        static_cast<void>(refresh.get());
    }
    catch (const std::exception&)
    {
        supersededRefreshRejected = true;
    }

    Expect(supersededRefreshRejected, "Un refresh d'une ancienne session doit etre rejete");
    const auto snapshot = sessionStore.Current();
    Expect(snapshot.userId == lila::shared::domain::UserId{2}, "La nouvelle session doit rester active");
    Expect(snapshot.token == "second-header.second-payload.second-signature", "Le token du nouvel utilisateur doit rester intact");
    Expect(refresherProbe->WasRevoked("rotated-refresh-token"), "Le refresh token devenu orphelin doit etre revoque");

    auto modifiedSnapshot = sessionStore.Current();
    modifiedSnapshot.username = "mutated-copy";
    Expect(sessionStore.Current().username == "second-user", "Current doit retourner une copie protegee");

    std::cout << "[TEST PASSED] SessionStoreRejectsSupersededConcurrentRefresh\n";
}

void TestAtomicFileWriterReplacesExistingContent()
{
    const std::filesystem::path path = std::filesystem::current_path() / "atomic-write-test.txt";

    lila::shared::persistence::WriteTextAtomically(path, "first", "atomic write failed");
    lila::shared::persistence::WriteTextAtomically(path, "second", "atomic write failed");

    std::ifstream file(path, std::ios::binary);
    std::string content((std::istreambuf_iterator<char>(file)), std::istreambuf_iterator<char>());
    file.close();
    std::filesystem::remove(path);

    Expect(content == "second", "Ecriture atomique devait remplacer le contenu");

    std::cout << "[TEST PASSED] AtomicFileWriterReplacesExistingContent\n";
}

void TestEncodingRoundTripUnicode()
{
    const std::string utf8 = "Caf\xC3\xA9 d\xC3\xA9j\xC3\xA0 \xE2\x80\x94 \xE6\xBC\xA2\xE5\xAD\x97";
    const wxString wide = lila::shared::text::FromUtf8(utf8);
    const std::string roundTrip = lila::shared::text::ToUtf8(wide);
    const std::wstring wideDirect = lila::shared::text::Utf8ToWide(utf8);

    Expect(roundTrip == utf8, "Round-trip UTF-8 invalide");
    Expect(!wideDirect.empty(), "Conversion wide attendue non vide");

    std::cout << "[TEST PASSED] EncodingRoundTripUnicode\n";
}

void TestEncodingRejectsInvalidUtf8()
{
    const std::string invalid("\xC3\x28", 2);
    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::text::FromUtf8(invalid));
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()) == lila::shared::errors::Utf8DecodeFailed, "Erreur UTF-8 attendue");
    }

    Expect(threw, "UTF-8 invalide devait echouer");

    std::cout << "[TEST PASSED] EncodingRejectsInvalidUtf8\n";
}

void TestBrokenAccentRepairCanBeToggled()
{
    const std::string broken = "cafÃ©";
    lila::shared::text::SetBrokenAccentRepairEnabled(false);
    Expect(lila::shared::text::FromUtf8(broken) == wxString(L"cafÃ©"), "Texte casse doit rester intact si option desactivee");

    lila::shared::text::SetBrokenAccentRepairEnabled(true);
    Expect(lila::shared::text::FromUtf8(broken) == wxString(L"café"), "Accent casse devait etre repare");

    std::cout << "[TEST PASSED] BrokenAccentRepairCanBeToggled\n";
}

void TestRealtimeProtocolFallbackTypeAndPayloadValidation()
{
    Expect(
        !lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"room.restore.ready","payload":{"roomId":42}})",
            "req-1",
            "vault.restore"),
        "Une notification de restauration ne doit pas terminer la requete vault.restore");
    Expect(
        lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"vault.restore","requestId":"req-1","payload":{"roomId":42}})",
            "req-1",
            "vault.restore"),
        "La reponse correlee de restauration doit etre acceptee");
    Expect(
        !lila::shared::network::realtime::protocol::IsResponseForRequest(
            R"({"type":"vault.restore","requestId":"req-2","payload":{"roomId":42}})",
            "req-1",
            "vault.restore"),
        "La reponse d'une autre requete doit etre ignoree");

    const auto response = lila::shared::network::realtime::protocol::ParseResponse(
        R"({"requestId":"req-1","success":true,"payload":{"ok":true}})",
        "req-1",
        "fallback.type");
    Expect(response.type == "fallback.type", "Fallback type attendu");
    Expect(response.success, "Succes attendu");

    bool threw = false;
    try
    {
        static_cast<void>(lila::shared::network::realtime::protocol::ParseResponse(
            R"({"type":"x","requestId":"req-1","payload":"oops"})",
            "req-1",
            "fallback.type"));
    }
    catch (const lila::shared::network::realtime::protocol::RealtimeProtocolError&)
    {
        threw = true;
    }

    Expect(threw, "Payload invalide devait echouer");

    std::cout << "[TEST PASSED] RealtimeProtocolFallbackTypeAndPayloadValidation\n";
}

void TestChatProtocolHandlesMalformedAndUnknownEvents()
{
    lila::modules::chat::infrastructure::ChatProtocol protocol;

    const auto ignored = protocol.ParseEvent(R"({"type":"social.friend.connected"})", 7, 123);
    Expect(ignored.type == lila::modules::chat::infrastructure::ChatEventType::Ignored, "Evenement inconnu doit etre ignore");

    const auto malformed = protocol.ParseEvent(
        R"({"type":"chat-history","editWindowSeconds":30,"messages":{"bad":true}})",
        7,
        123);
    Expect(malformed.type == lila::modules::chat::infrastructure::ChatEventType::Error, "Historique malforme doit produire une erreur");

    const auto unicode = protocol.ParseEvent(
        "{\"type\":\"chat-message\",\"payload\":{\"id\":\"42\",\"text\":\"caf\xC3\xA9\",\"createdAt\":\"2026-08-20T12:00:00Z\",\"user\":{\"id\":7,\"username\":\"\xC3\xA9lise\"}}}",
        7,
        0);
    Expect(unicode.type == lila::modules::chat::infrastructure::ChatEventType::MessageUpserted, "Message unicode attendu");
    Expect(unicode.messages.size() == 1, "Un message attendu");
    Expect(unicode.messages.front().text == "caf\xC3\xA9", "Texte unicode preserve attendu");

    std::cout << "[TEST PASSED] ChatProtocolHandlesMalformedAndUnknownEvents\n";
}

void TestChatMessageStoreEnforcesLimits()
{
    lila::modules::chat::application::ChatMessageStore store;
    lila::modules::chat::application::ChatMessageStore::Messages messages;
    for (std::size_t index = 0; index < lila::modules::chat::infrastructure::fields::MaxHistoryMessages + 5; ++index)
    {
        lila::modules::chat::domain::ChatMessage message;
        message.id = "m" + std::to_string(index);
        message.text = "text";
        messages.push_back(std::move(message));
    }

    store.LoadHistory(std::move(messages), -12);
    const auto snapshot = store.Snapshot();
    Expect(snapshot.size() == lila::modules::chat::infrastructure::fields::MaxHistoryMessages, "Limite historique attendue");
    Expect(store.EditWindowSeconds() == 0, "Fenetre edition negative doit etre ramenee a zero");
    Expect(snapshot.front().id == "m5", "Les plus anciens messages doivent etre purges");

    std::cout << "[TEST PASSED] ChatMessageStoreEnforcesLimits\n";
}

void TestChatMessageActionRights()
{
    using lila::modules::chat::domain::ChatMessage;
    using lila::modules::chat::presentation::ChatMessageActions;

    constexpr std::time_t nowUtc = 1'000;

    ChatMessage editable;
    editable.id = "m1";
    editable.isMine = true;
    editable.timestampUtc = nowUtc - 10;
    Expect(ChatMessageActions::CanActOnMessage(editable, 30, nowUtc), "Message perso recent doit etre editable");

    ChatMessage expired = editable;
    expired.timestampUtc = nowUtc - 31;
    Expect(!ChatMessageActions::CanActOnMessage(expired, 30, nowUtc), "Message hors fenetre ne doit plus etre editable");

    ChatMessage future = editable;
    future.timestampUtc = nowUtc + 1;
    Expect(!ChatMessageActions::CanActOnMessage(future, 30, nowUtc), "Message futur ne doit pas etre editable");

    ChatMessage foreign = editable;
    foreign.isMine = false;
    Expect(!ChatMessageActions::CanActOnMessage(foreign, 30, nowUtc), "Message tiers ne doit pas etre editable");

    ChatMessage noId = editable;
    noId.id.clear();
    Expect(!ChatMessageActions::CanActOnMessage(noId, 30, nowUtc), "Message sans id ne doit pas etre editable");

    Expect(!ChatMessageActions::CanActOnMessage(editable, 0, nowUtc), "Fenetre nulle doit interdire l'action");

    std::cout << "[TEST PASSED] ChatMessageActionRights\n";
}

void TestActionButtonKeyboardSemantics()
{
    using lila::shared::accessibility::ActionButton;

    Expect(ActionButton::ShouldActivateOnKeyCode(WXK_RETURN), "Entree doit activer le bouton");
    Expect(ActionButton::ShouldActivateOnKeyCode(WXK_SPACE), "Espace doit activer le bouton");
    Expect(!ActionButton::ShouldActivateOnKeyCode(WXK_ESCAPE), "Echap ne doit pas activer le bouton");

    Expect(ActionButton::ShouldPreserveVerticalNavigation(WXK_UP), "Fleche haut doit preservER la navigation");
    Expect(ActionButton::ShouldPreserveVerticalNavigation(WXK_NUMPAD_DOWN), "Fleche bas pave numerique doit preserver la navigation");
    Expect(!ActionButton::ShouldPreserveVerticalNavigation(WXK_TAB), "Tab ne doit pas etre traite comme fleche");
    Expect(ActionButton::ShouldSuppressHorizontalNavigation(WXK_LEFT), "Fleche gauche doit etre ignoree");
    Expect(ActionButton::ShouldSuppressHorizontalNavigation(WXK_NUMPAD_RIGHT), "Fleche droite pave numerique doit etre ignoree");
    Expect(ActionButton::ShouldSuppressTabNavigation(WXK_TAB), "Tab doit etre ignore dans les menus");
    Expect(ActionButton::ShouldSuppressTabNavigation(WXK_NUMPAD_TAB), "Tab pave numerique doit etre ignore dans les menus");

    std::cout << "[TEST PASSED] ActionButtonKeyboardSemantics\n";
}

void TestNavigationControllerKeyboardSemantics()
{
    using Navigator = lila::shared::accessibility::NavigationController;

    Expect(Navigator::IsTabKey(WXK_TAB), "Tab doit etre reconnu");
    Expect(Navigator::IsTabKey(WXK_NUMPAD_TAB), "Tab pave numerique doit etre reconnu");
    Expect(!Navigator::IsTabKey(WXK_DOWN), "Fleche bas ne doit pas etre reconnue comme tab");

    Expect(Navigator::IsVerticalKey(WXK_UP), "Fleche haut doit etre reconnue");
    Expect(Navigator::IsVerticalKey(WXK_NUMPAD_DOWN), "Fleche bas pave numerique doit etre reconnue");
    Expect(!Navigator::IsVerticalKey(WXK_RETURN), "Entree ne doit pas etre reconnue comme verticale");

    Expect(
        Navigator::ComputeTargetIndex(3, 0, Navigator::Direction::Forward, Navigator::Boundary::Wrap) == 1,
        "Navigation suivante attendue");
    Expect(
        Navigator::ComputeTargetIndex(3, 2, Navigator::Direction::Forward, Navigator::Boundary::Wrap) == 0,
        "Wrap avant attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 0, Navigator::Direction::Backward, Navigator::Boundary::Wrap) == 2,
        "Wrap arriere attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 2, Navigator::Direction::Forward, Navigator::Boundary::Clamp) == 2,
        "Clamp avant attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 0, Navigator::Direction::Backward, Navigator::Boundary::Clamp) == 0,
        "Clamp arriere attendu");
    Expect(
        Navigator::ComputeTargetIndex(3, 9, Navigator::Direction::Forward, Navigator::Boundary::Wrap) == 0,
        "Index invalide avant doit revenir au debut");
    Expect(
        Navigator::ComputeTargetIndex(3, 9, Navigator::Direction::Backward, Navigator::Boundary::Wrap) == 2,
        "Index invalide arriere doit revenir a la fin");

    std::cout << "[TEST PASSED] NavigationControllerKeyboardSemantics\n";
}

void TestCatalogPayloadCodecReadsShelfTree()
{
    const nlohmann::json payload = {
        {"categories", nlohmann::json::array({
            {
                {"id", "sacred-winds"},
                {"name", "Vents sacres"},
                {"children", nlohmann::json::array({
                    {
                        {"id", "board-games"},
                        {"name", "Jeux de plateau"},
                        {"children", nlohmann::json::array()},
                    },
                })},
            },
            {
                {"id", "dancing-winds"},
                {"name", "Vents dansants"},
                {"children", nlohmann::json::array()},
            },
        })},
        {"games", nlohmann::json::array({{
            {"id", "four-winds"},
            {"name", "Les quatre vents"},
            {"minPlayers", 2},
            {"maxPlayers", 4},
            {"categories", nlohmann::json::array({"board-games"})},
        }})},
    };

    const auto shelves = lila::modules::catalog::infrastructure::codec::ReadShelvesPayload(payload);
    Expect(shelves.size() == 2, "Deux etageres catalogue attendues");
    Expect(shelves[0].id == "sacred-winds", "Identifiant de la premiere etagere attendu");
    Expect(shelves[0].children.size() == 1, "Sous-etagere attendue");
    Expect(shelves[0].children[0].name == "Jeux de plateau", "Nom de sous-etagere attendu");
    Expect(shelves[0].children[0].games.size() == 1, "Jeu attache a la sous-etagere attendu");
    Expect(shelves[0].children[0].games[0].id == "four-winds", "Identifiant de jeu attendu");

    bool threw = false;
    try
    {
        static_cast<void>(lila::modules::catalog::infrastructure::codec::ReadShelvesPayload(
            nlohmann::json{{"categories", nlohmann::json::object()}}));
    }
    catch (const std::exception&)
    {
        threw = true;
    }
    Expect(threw, "Un tableau categories invalide doit etre refuse");

    std::cout << "[TEST PASSED] CatalogPayloadCodecReadsShelfTree\n";
}

void TestRoomPayloadCodecs()
{
    const auto publicRooms = lila::modules::rooms::infrastructure::codec::ReadPublicRooms({
        {"items", nlohmann::json::array({{
            {"id", 12}, {"name", "Table du soir"}, {"gameType", "four-winds"},
            {"status", "waiting"}, {"started", false}, {"spectatorOnly", false},
            {"maxPlayers", 4}, {"playersCount", 2}, {"botsCount", 1},
            {"owner", {{"username", "alice"}}},
        }})},
    });
    Expect(publicRooms.size() == 1, "Une table publique attendue");
    Expect(publicRooms[0].ownerUsername == "alice", "Proprietaire de table attendu");
    Expect(publicRooms[0].playersCount == 2, "Nombre de joueurs attendu");

    const auto room = lila::modules::rooms::infrastructure::codec::ReadRoomState({
        {"manifest", {
            {"id", "four-winds"}, {"name", "Les quatre vents"},
            {"minPlayers", 2}, {"maxPlayers", 4}}},
        {"room", {
            {"id", 12}, {"name", "Table du soir"}, {"gameType", "four-winds"},
            {"status", "setup"}, {"startedAt", "2026-08-21T18:00:00.000Z"},
            {"isPrivate", false}, {"maxPlayers", 4},
            {"owner", {{"id", 1}, {"username", "alice"}}},
            {"players", nlohmann::json::array({{{"id", 1}, {"username", "alice"}}})},
            {"spectators", nlohmann::json::array()},
            {"bots", nlohmann::json::array({{{"id", 3}, {"name", "LilaBot"}}})},
            {"allowedActions", nlohmann::json::array({"room.snapshot.save"})},
        }},
    });
    Expect(room.id == 12, "Identifiant d'etat de table attendu");
    Expect(room.gameName == "Les quatre vents", "Nom de jeu de la table attendu");
    Expect(room.minPlayers == 2 && room.maxPlayers == 4, "Bornes de joueurs attendues");
    Expect(room.ownerId == 1 && room.ownerName == "alice", "Proprietaire attendu");
    Expect(room.players.size() == 1 && room.bots.size() == 1, "Participants de table attendus");
    Expect(room.started, "startedAt doit marquer la table comme demarree");
    Expect(
        lila::modules::rooms::presentation::RoomShortcutPolicy::Resolve(
            'S', true, false, false, false, room) == "room:save",
        "Controle S doit accepter une table demarree via startedAt");

    std::cout << "[TEST PASSED] RoomPayloadCodecs\n";
}

void TestRoomSessionGatewayUsesWpfHandshakeContract()
{
    lila::modules::session::application::SessionStore sessionStore(
        std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    FakeRoomWebSocketClient socket;
    socket.responses.push_back(nlohmann::json{
        {"type", "room.created"},
        {"roomId", 42},
        {"payload", {
            {"manifest", {{"id", "four-winds"}, {"name", "Les quatre vents"}}},
            {"room", {
                {"id", 42}, {"name", "Table d'Alice"}, {"gameType", "four-winds"},
                {"status", "waiting"}, {"isPrivate", false}, {"maxPlayers", 4},
                {"players", nlohmann::json::array({{{"id", 7}, {"username", "alice"}}})},
                {"spectators", nlohmann::json::array()},
                {"bots", nlohmann::json::array()},
                {"allowedActions", nlohmann::json::array({"room.start"})},
            }},
        }},
    }.dump());
    FakeRoomTicketProvider tickets;
    lila::modules::rooms::infrastructure::RoomSessionGateway gateway(
        "wss://example.test/ws", socket, tickets, sessionStore);

    const auto room = gateway.Create("four-winds", {});
    Expect(room.id == 42, "Table creee attendue");
    Expect(socket.endpoint == "wss://example.test/ws", "Endpoint room /ws attendu");
    Expect(
        tickets.requestedScope == lila::shared::network::ws::WsTicketScopeRoom,
        "Ticket de portee room attendu");
    Expect(
        tickets.requestedBearerToken == session.token,
        "JWT transmis au fournisseur de ticket attendu");
    Expect(
        socket.headers.at(std::string(lila::shared::network::ws::AuthorizationHeader)) ==
            "Bearer " + session.token,
        "Header Authorization Bearer attendu");
    Expect(
        socket.headers.at(std::string(lila::shared::network::ws::WsTicketHeader)) == "room-ticket",
        "Header ticket room attendu");
    Expect(
        socket.headers.contains(std::string(lila::shared::network::ws::ClientVersionHeader)),
        "Version client attendue dans le handshake");
    Expect(socket.sentPayloads.size() == 1, "Une commande room.create attendue");
    const auto command = nlohmann::json::parse(socket.sentPayloads.front());
    Expect(command.at("type") == "room.create", "Type room.create attendu");
    Expect(command.at("payload").at("gameType") == "four-winds", "gameType cree attendu");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.updated"},
        {"roomId", 42},
        {"payload", {
            {"manifest", {
                {"id", "four-winds"}, {"name", "Les quatre vents"},
                {"minPlayers", 2}, {"maxPlayers", 4}}},
            {"room", {
                {"id", 42}, {"name", "Table d'Alice"}, {"gameType", "four-winds"},
                {"status", "setup"}, {"isPrivate", false}, {"maxPlayers", 4},
                {"owner", {{"id", 7}, {"username", "alice"}}},
                {"players", nlohmann::json::array({{{"id", 7}, {"username", "alice"}}})},
                {"spectators", nlohmann::json::array()},
                {"bots", nlohmann::json::array()},
                {"allowedActions", nlohmann::json::array({"room.start"})},
            }},
        }},
    }.dump());
    const auto startedPayload = nlohmann::json{
        {"type", "room.updated"},
        {"roomId", 42},
        {"payload", {
            {"manifest", {
                {"id", "four-winds"}, {"name", "Les quatre vents"},
                {"minPlayers", 2}, {"maxPlayers", 4}}},
            {"room", {
                {"id", 42}, {"name", "Table d'Alice"}, {"gameType", "four-winds"},
                {"status", "started"}, {"isPrivate", false}, {"maxPlayers", 4},
                {"owner", {{"id", 7}, {"username", "alice"}}},
                {"players", nlohmann::json::array({{{"id", 7}, {"username", "alice"}}})},
                {"spectators", nlohmann::json::array()},
                {"bots", nlohmann::json::array()},
                {"allowedActions", nlohmann::json::array({"room.reset", "room.snapshot.save"})},
            }},
        }},
    }.dump();
    auto startFuture = std::async(
        std::launch::async,
        [&gateway]() { gateway.Execute({lila::modules::rooms::domain::RoomCommand::Start}, {}); });
    const auto startCommand = nlohmann::json::parse(socket.WaitForSentPayload(2));
    Expect(startCommand.at("type") == "room.start", "Commande room.start attendue");
    const auto setup = gateway.ReceiveEvent({});
    Expect(
        setup.type == lila::modules::rooms::domain::RoomEventType::StateUpdated &&
            setup.room.has_value() && setup.room->status == "setup",
        "Premier evenement room.updated attendu");
    socket.QueueResponse(nlohmann::json{
        {"type", "room.ack"},
        {"payload", {
            {"action", "room.start"},
            {"traceId", startCommand.at("payload").at("_trace").at("id")}}},
    }.dump());
    Expect(
        gateway.ReceiveEvent({}).type == lila::modules::rooms::domain::RoomEventType::Ignored,
        "Accuse de reception ignore par le flux metier attendu");
    startFuture.get();
    socket.QueueResponse(startedPayload);
    const auto started = gateway.ReceiveEvent({});
    Expect(
        started.room.has_value() && started.room->status == "started",
        "Table demarree attendue dans le flux d'evenements");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.intent"},
        {"payload", {{"type", "announcement"}, {"payload", {{"message", "Partie demarree"}}}}},
    }.dump());
    const auto privacyPayload = nlohmann::json{
        {"type", "room.privacy"},
        {"payload", {{"isPrivate", true}}},
    }.dump();
    auto privacyFuture = std::async(
        std::launch::async,
        [&gateway]()
        {
            gateway.Execute(
                {lila::modules::rooms::domain::RoomCommand::TogglePrivacy}, {});
        });
    const auto privacyCommand = nlohmann::json::parse(socket.WaitForSentPayload(3));
    const auto announcement = gateway.ReceiveEvent({});
    Expect(
        announcement.type == lila::modules::rooms::domain::RoomEventType::Announcement,
        "Annonce de table attendue");
    socket.QueueResponse(nlohmann::json{
        {"type", "room.ack"},
        {"payload", {
            {"action", "room.toggle-privacy"},
            {"traceId", privacyCommand.at("payload").at("_trace").at("id")}}},
    }.dump());
    Expect(
        gateway.ReceiveEvent({}).type == lila::modules::rooms::domain::RoomEventType::Ignored,
        "Accuse de confidentialite ignore attendu");
    privacyFuture.get();
    socket.QueueResponse(privacyPayload);
    const auto privacy = gateway.ReceiveEvent({});
    Expect(
        privacy.type == lila::modules::rooms::domain::RoomEventType::PrivacyChanged && privacy.value,
        "Table privee attendue");
    Expect(
        privacy.message == std::string("Table priv" "\xC3\xA9" "e."),
        "Annonce de table privee attendue");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.info"},
        {"payload", {{"message", "Table privee, 1 joueur."}}},
    }.dump());
    gateway.Execute({lila::modules::rooms::domain::RoomCommand::Info}, {});
    const auto info = gateway.ReceiveEvent({});
    Expect(
        info.type == lila::modules::rooms::domain::RoomEventType::Info &&
            info.message == "Table privee, 1 joueur.",
        "Informations de table attendues");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.chat.message"},
        {"payload", {{"userId", 7}, {"username", "alice"}, {"message", "Bonjour"}}},
    }.dump());
    const auto chat = gateway.ReceiveEvent({});
    Expect(
        chat.type == lila::modules::rooms::domain::RoomEventType::ChatMessage &&
            chat.chatMessages.size() == 1 && chat.chatMessages.front().username == "alice" &&
            chat.chatMessages.front().message == "Bonjour",
        "Message de chat type attendu");

    socket.responses.push_back(nlohmann::json{
        {"type", "room.deleted"},
        {"roomId", 42},
    }.dump());
    Expect(
        gateway.ReceiveEvent({}).type == lila::modules::rooms::domain::RoomEventType::Closed,
        "Fermeture de table typee attendue");

    std::cout << "[TEST PASSED] RoomSessionGatewayUsesWpfHandshakeContract\n";
}

void TestRoomPresentationMatchesWpfWaitingTable()
{
    lila::modules::rooms::domain::RoomState room;
    room.id = 42;
    room.name = "Table d'Alice";
    room.gameType = "four-winds";
    room.gameName = "Les quatre vents";
    room.status = "setup";
    room.minPlayers = 2;
    room.maxPlayers = 4;
    room.players.push_back({7, "alice"});
    room.allowedActions = {
        "room.start", "bot.add", "bot.remove", "room.info", "room.players",
        "room.toggle-privacy", "room.set-role", "room.reset", "room.snapshot.save",
        "room.leave"};

    using Model = lila::modules::rooms::presentation::RoomPresentationModel;
    using ShortcutPolicy = lila::modules::rooms::presentation::RoomShortcutPolicy;
    const auto items = Model::BuildItems(room);
    Expect(!items.empty() && items.front().id == "room:start", "Nom du jeu activable en premier attendu");
    Expect(items.front().label == wxString::FromUTF8("Les quatre vents"), "Nom du jeu WPF attendu");
    Expect(Model::ActionForId(items.front().id) == Model::Action::Start, "Entree doit demarrer la table");
    Expect(
        std::any_of(items.begin(), items.end(), [](const auto& item) { return item.id == "room:add-bot"; }),
        "Action ajouter un bot attendue");
    Expect(
        std::any_of(items.begin(), items.end(), [](const auto& item) { return item.id == "room:save"; }),
        "Sauvegarde proposee quand le serveur l'autorise attendue");
    Expect(
        ShortcutPolicy::Resolve('H', true, false, false, false, room) == "room:privacy",
        "Controle H doit changer la visibilite pour le proprietaire");
    Expect(
        ShortcutPolicy::Resolve('S', true, false, false, false, room) == "room:save",
        "Controle S doit transmettre la tentative au serveur");
    Expect(
        Model::BuildPlayers(room) == wxString::FromUTF8(
            "Joueurs : alice. Spectateurs : aucun. Bots : aucun."),
        "Annonce complete des joueurs attendue");

    auto restrictedRoom = room;
    restrictedRoom.allowedActions.erase(
        std::remove(restrictedRoom.allowedActions.begin(), restrictedRoom.allowedActions.end(), "room.players"),
        restrictedRoom.allowedActions.end());
    restrictedRoom.allowedActions.erase(
        std::remove(restrictedRoom.allowedActions.begin(), restrictedRoom.allowedActions.end(), "room.leave"),
        restrictedRoom.allowedActions.end());
    const auto restrictedItems = Model::BuildItems(restrictedRoom);
    Expect(
        std::none_of(restrictedItems.begin(), restrictedItems.end(), [](const auto& item)
        {
            return item.id == "room:players" || item.id == "room:leave";
        }),
        "Raccourcis limites aux actions autorisees attendus");

    room.status = "started";
    const auto startedItems = Model::BuildItems(room);
    Expect(startedItems.front().id == "room:game", "Jeu non redemarrable apres demarrage attendu");
    Expect(
        std::any_of(startedItems.begin(), startedItems.end(), [](const auto& item) { return item.id == "room:save"; }),
        "Sauvegarde disponible pendant la partie attendue");
    Expect(
        std::none_of(startedItems.begin(), startedItems.end(), [](const auto& item) { return item.id == "room:add-bot"; }),
        "Ajout de bot masque pendant la partie attendu");
    Expect(
        ShortcutPolicy::Resolve('S', true, false, false, false, room) == "room:save",
        "Controle S doit sauvegarder une partie demarree");

    room.allowedActions.erase(
        std::remove(room.allowedActions.begin(), room.allowedActions.end(), "room.toggle-privacy"),
        room.allowedActions.end());
    Expect(
        ShortcutPolicy::Resolve('H', true, false, false, false, room).empty(),
        "Controle H doit respecter les permissions serveur");

    std::cout << "[TEST PASSED] RoomPresentationMatchesWpfWaitingTable\n";
}

void TestVaultPayloadCodec()
{
    const auto saveRequest = lila::modules::vault::infrastructure::codec::BuildSaveRequest(42);
    Expect(saveRequest.at("roomId") == 42, "roomId de sauvegarde attendu");
    Expect(!saveRequest.contains("id"), "Le client ne doit pas choisir l'identifiant de sauvegarde");
    const auto abandonRequest = lila::modules::vault::infrastructure::codec::BuildAbandonRequest(42);
    Expect(abandonRequest.at("roomId") == 42, "roomId d'abandon attendu");
    const auto snapshots = lila::modules::vault::infrastructure::codec::ReadSnapshots({
        {"items", nlohmann::json::array({{
            {"id", "snapshot-1"}, {"name", "Sauvegarde 1"},
            {"roomName", "Table du soir"}, {"gameType", "four-winds"},
            {"playersLabel", "alice, bob"}, {"createdAt", "2026-08-21T10:00:00.000Z"},
        }})},
    });
    Expect(snapshots.size() == 1, "Une sauvegarde attendue");
    Expect(snapshots[0].playersLabel == "alice, bob", "Joueurs sauvegardes attendus");
    Expect(
        lila::modules::vault::infrastructure::codec::ReadSavedId({{"id", "snapshot-2"}}) == "snapshot-2",
        "Identifiant sauvegarde attendu");
    Expect(
        lila::modules::vault::infrastructure::codec::ReadRestoredRoomId({{"roomId", 42}}) == 42,
        "Identifiant de table restauree attendu");
    lila::modules::vault::infrastructure::codec::ValidateAbandon({{"ok", true}});

    std::cout << "[TEST PASSED] VaultPayloadCodec\n";
}

void TestRoomAndVaultPresentationState()
{
    using lila::modules::vault::domain::VaultSnapshot;
    using lila::modules::vault::presentation::VaultNavigator;

    VaultNavigator navigator;
    navigator.Reset({
        VaultSnapshot{
            "first", "1000 miles, 21/08/2026 (anian)", "Table 1000 miles restauree",
            "game", "anian", "2026-08-21T20:11:00"},
        VaultSnapshot{"second", "Deuxieme", "Table B", "game", "bob", "date"},
    });
    const auto vaultItems =
        lila::modules::vault::presentation::VaultPresentationModel::BuildItems(navigator, false);
    Expect(
        vaultItems.front().label == wxString::FromUTF8("1000 miles avec anian, 21.08.2026 20:11"),
        "Libelle de sauvegarde aligne sur le client WPF attendu");
    navigator.Select(1);
    Expect(
        navigator.Activate(1) == VaultNavigator::Activation::Restore,
        "Entree doit restaurer directement la sauvegarde selectionnee");
    Expect(navigator.SelectedIndex() == 1, "Selection de sauvegarde restauree attendue");
    navigator.RemoveSelected();
    Expect(navigator.Snapshots().size() == 1, "Suppression locale de sauvegarde attendue");

    const auto create = lila::modules::rooms::presentation::RoomOpenRequest::Create("four-winds");
    Expect(create.gameType == "four-winds", "Requete de creation attendue");
    const auto join = lila::modules::rooms::presentation::RoomOpenRequest::Join(42, true);
    Expect(join.roomId == 42 && join.spectator, "Requete de jonction attendue");
    const auto restore = lila::modules::rooms::presentation::RoomOpenRequest::Restore(43);
    Expect(
        restore.kind == lila::modules::rooms::presentation::RoomOpenRequest::Kind::Restore &&
            restore.roomId == 43 && !restore.spectator,
        "Requete de restauration distincte attendue");

    lila::modules::rooms::presentation::RoomLobbyNavigator lobby;
    lobby.Reset({lila::modules::rooms::domain::PublicRoom{
        42, "Table", "game", "waiting", false, false, 4, 2, 0, "alice"}});
    Expect(lobby.SelectedRoom() != nullptr, "Table publique selectionnee attendue");
    Expect(lobby.SelectedRoom()->id == 42, "Identifiant de table publique attendu");

    std::cout << "[TEST PASSED] RoomAndVaultPresentationState\n";
}

void TestCatalogShelfNavigatorRestoresParentSelection()
{
    using lila::modules::catalog::domain::CatalogGame;
    using lila::modules::catalog::domain::CatalogShelf;
    using lila::modules::catalog::presentation::CatalogShelfNavigator;

    CatalogShelfNavigator navigator;
    navigator.Reset({
        CatalogShelf{"first", "Premiere", {}},
        CatalogShelf{
            "second",
            "Deuxieme",
            {
                CatalogShelf{"child-a", "Enfant A", {}},
                CatalogShelf{"child-b", "Enfant B", {}},
            }},
        CatalogShelf{
            "games",
            "Vents sacres",
            {},
            {
                CatalogGame{"first-game", "Foulees fantastiques"},
                CatalogGame{"second-game", "Morpion"},
            }},
    });

    Expect(navigator.CurrentShelves().size() == 3, "Trois etageres racines attendues");
    Expect(navigator.Enter(1), "L'etagere avec enfants devait etre ouverte");
    Expect(navigator.CurrentShelves().size() == 2, "Deux sous-etageres attendues");
    navigator.Select(1);
    Expect(!navigator.Enter(1), "Une etagere feuille ne devait pas ouvrir de niveau");
    Expect(navigator.Back(), "Le retour au niveau racine devait reussir");
    Expect(navigator.SelectedIndex() == 1, "La selection parente devait etre restauree");
    Expect(!navigator.Back(), "Le niveau racine ne devait pas pouvoir remonter");

    Expect(navigator.Enter(2), "L'etagere de jeux devait etre ouverte");
    Expect(navigator.IsShowingGames(), "La liste des jeux devait etre affichee");
    navigator.Select(1);
    Expect(navigator.Back(), "Le retour depuis les jeux devait reussir");
    Expect(!navigator.IsShowingGames(), "La liste des etageres devait etre restauree");
    Expect(navigator.SelectedIndex() == 2, "L'etagere de jeux devait retrouver le focus");

    std::cout << "[TEST PASSED] CatalogShelfNavigatorRestoresParentSelection\n";
}

void TestStoryBookPayloadAndNavigation()
{
    const nlohmann::json payload = {
        {"games", nlohmann::json::array({
            {
                {"gameType", "first"},
                {"gameName", "Premier jeu"},
                {"withBots", {{"finished", 4}, {"quit", 1}, {"won", 3}, {"lost", 1}}},
                {"withoutBots", {{"finished", 2}, {"quit", 0}, {"won", 1}, {"lost", 1}}},
            },
            {
                {"gameType", "second"},
                {"gameName", "Deuxieme jeu"},
                {"withBots", {{"finished", 8}, {"quit", 2}, {"won", 5}, {"lost", 3}}},
                {"withoutBots", {{"finished", 6}, {"quit", 1}, {"won", 4}, {"lost", 2}}},
            },
        })},
    };

    auto games = lila::modules::storybook::infrastructure::codec::ReadStoryBookPayload(payload);
    Expect(games.size() == 2, "Deux jeux du livre des contes attendus");
    Expect(games[1].withoutBots.won == 4, "Statistiques sans bots attendues");

    lila::modules::storybook::presentation::StoryBookNavigator navigator;
    navigator.OpenGames(std::move(games));
    Expect(navigator.Activate(1), "Ouverture des modes attendue");
    Expect(navigator.Activate(1), "Ouverture des details attendue");
    Expect(!navigator.CurrentModeUsesBots(), "Mode sans bots attendu");
    Expect(navigator.CurrentCounts() != nullptr && navigator.CurrentCounts()->finished == 6, "Details du mode attendus");
    navigator.Select(3);
    Expect(navigator.Back(), "Retour aux modes attendu");
    Expect(navigator.SelectedIndex() == 1, "Selection du mode restauree");
    Expect(navigator.Back(), "Retour aux jeux attendu");
    Expect(navigator.SelectedIndex() == 1, "Selection du jeu restauree");

    bool rejected = false;
    try
    {
        static_cast<void>(lila::modules::storybook::infrastructure::codec::ReadStoryBookPayload(
            nlohmann::json{{"games", nlohmann::json::array({{{"gameType", "bad"}}})}}));
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    Expect(rejected, "Un jeu incomplet devait etre refuse");

    std::cout << "[TEST PASSED] StoryBookPayloadAndNavigation\n";
}

void TestLeaderboardPayloadAndNavigation()
{
    const nlohmann::json gamesPayload = {
        {"games", nlohmann::json::array({
            {{"gameType", "first"}, {"gameName", "Premier jeu"}},
            {{"gameType", "second"}, {"gameName", "Deuxieme jeu"}},
        })},
    };
    auto games = lila::modules::leaderboard::infrastructure::codec::ReadGamesPayload(gamesPayload);
    Expect(games.size() == 2, "Deux jeux de classement attendus");

    nlohmann::json entries = nlohmann::json::array();
    for (int index = 0; index < 11; ++index)
    {
        entries.push_back({
            {"userId", index + 1},
            {"username", "player-" + std::to_string(index + 1)},
            {"wins", 20 - index},
            {"losses", index},
            {"finished", 20},
            {"quit", 0},
        });
    }
    auto top = lila::modules::leaderboard::infrastructure::codec::ReadTopPayload(
        nlohmann::json{{"gameType", "second"}, {"entries", std::move(entries)}});
    Expect(top.entries.size() == 11, "Toutes les entrees valides devaient etre decodees");
    Expect(top.entries.front().wins == 20, "Le nombre de victoires devait etre conserve");

    lila::modules::leaderboard::presentation::LeaderboardNavigator navigator;
    navigator.ResetGames(std::move(games));
    navigator.OpenTop(1, std::move(top));
    Expect(navigator.CurrentGame() != nullptr && navigator.CurrentGame()->gameType == "second", "Jeu classe attendu");
    Expect(navigator.ItemCount() == 10, "Le classement affiche devait etre limite au top 10");
    navigator.Select(9);
    Expect(navigator.Back(), "Retour aux jeux du classement attendu");
    Expect(navigator.SelectedIndex() == 1, "Selection du jeu classe restauree");

    bool rejected = false;
    try
    {
        static_cast<void>(lila::modules::leaderboard::infrastructure::codec::ReadTopPayload(
            nlohmann::json{
                {"gameType", "bad"},
                {"entries", nlohmann::json::array({{
                    {"userId", 1},
                    {"username", "bad"},
                    {"wins", -1},
                    {"losses", 0},
                    {"finished", 0},
                    {"quit", 0},
                }})},
            }));
    }
    catch (const std::exception&)
    {
        rejected = true;
    }
    Expect(rejected, "Une entree de classement negative devait etre refusee");

    std::cout << "[TEST PASSED] LeaderboardPayloadAndNavigation\n";
}

void TestEnsureSuccessOrThrowClearsExpiredSession()
{
    lila::modules::session::application::SessionStore sessionStore(std::make_unique<InMemorySessionRepository>());
    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{42};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::shared::network::realtime::RealtimeApiResponse response;
    response.success = false;
    response.statusCode = 401;
    response.errorMessage = "expired";

    bool threw = false;
    try
    {
        lila::shared::network::realtime::helpers::EnsureSuccessOrThrow(response, sessionStore, "fallback");
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()) == lila::shared::errors::SessionExpiredMessage, "SessionExpired attendu");
    }

    Expect(threw, "Session expiree devait lever une exception");
    Expect(!sessionStore.HasActiveSession(), "La session devait etre videe");

    lila::shared::network::realtime::RealtimeApiResponse rejected;
    rejected.success = false;
    rejected.errorKind = lila::shared::network::realtime::RealtimeErrorKind::Server;
    rejected.errorMessage = "Vous devez lancer le jeu avant de pouvoir sauvegarder.";
    bool serverMessagePreserved = false;
    try
    {
        lila::shared::network::realtime::helpers::EnsureSuccessOrThrow(
            rejected, sessionStore, "Operation impossible dans le coffre fort.");
    }
    catch (const lila::shared::errors::AppException& error)
    {
        serverMessagePreserved = error.Error().UserMessage() == rejected.errorMessage;
    }
    Expect(serverMessagePreserved, "Le motif du refus serveur devait etre affiche");

    std::cout << "[TEST PASSED] EnsureSuccessOrThrowClearsExpiredSession\n";
}

void TestChatServiceCloseInterruptsReceiveLoop()
{
    lila::shared::concurrency::BackgroundExecutor executor({.workerCount = 1, .queueCapacity = 16});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);

    FakeChatGateway gateway;
    gateway.receiveSteps.push_back({false, "history"});

    FakeChatProtocol protocol;
    lila::modules::session::application::SessionStore sessionStore(std::make_unique<InMemorySessionRepository>());
    lila::modules::options::application::OptionsStore optionsStore(std::make_unique<InMemoryOptionsRepository>());
    optionsStore.Load();
    FakeAudioService audioService;

    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::modules::chat::application::ChatService service(
        gateway, protocol, sessionStore, optionsStore, audioService);
    Expect(service.Open(), "Ouverture chat attendue");
    WaitUntil([&service]() { return !service.Messages().empty(); }, "Historique initial attendu");

    service.Close();
    Expect(service.State() == lila::modules::chat::domain::ChatState::Disconnected, "Etat deconnexion attendu");
    Expect(gateway.interruptCount >= 1, "Interrupt attendu");

    executor.Shutdown();
    lila::shared::concurrency::UninstallBackgroundExecutor();

    std::cout << "[TEST PASSED] ChatServiceCloseInterruptsReceiveLoop\n";
}

void TestChatServiceReconnectsAfterTransientFailure()
{
    lila::shared::concurrency::BackgroundExecutor executor({.workerCount = 1, .queueCapacity = 16});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);

    FakeChatGateway gateway;
    gateway.openFailures = {false, true, false};
    gateway.receiveSteps.push_back({false, "history"});
    gateway.receiveSteps.push_back({true, "socket lost"});
    gateway.receiveSteps.push_back({false, "history-2"});

    FakeChatProtocol protocol;
    lila::modules::session::application::SessionStore sessionStore(std::make_unique<InMemorySessionRepository>());
    lila::modules::options::application::OptionsStore optionsStore(std::make_unique<InMemoryOptionsRepository>());
    optionsStore.Load();
    FakeAudioService audioService;

    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::modules::chat::application::ChatService service(
        gateway, protocol, sessionStore, optionsStore, audioService);
    Expect(service.Open(), "Ouverture chat attendue");

    WaitUntil([&gateway]() { std::lock_guard lock(gateway.mutex_); return gateway.openCount >= 3; }, "Reconnexions attendues");
    WaitUntil([&service]() { return service.State() == lila::modules::chat::domain::ChatState::Connected; }, "Etat reconnecte attendu");

    service.Close();
    executor.Shutdown();
    lila::shared::concurrency::UninstallBackgroundExecutor();

    std::cout << "[TEST PASSED] ChatServiceReconnectsAfterTransientFailure\n";
}

void TestChatServiceSendReportsTransportFailure()
{
    lila::shared::concurrency::BackgroundExecutor executor({.workerCount = 1, .queueCapacity = 16});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);

    FakeChatGateway gateway;
    gateway.openFailures = {false};
    gateway.receiveSteps.push_back({false, "history"});
    gateway.sendShouldThrow = true;

    FakeChatProtocol protocol;
    lila::modules::session::application::SessionStore sessionStore(std::make_unique<InMemorySessionRepository>());
    lila::modules::options::application::OptionsStore optionsStore(std::make_unique<InMemoryOptionsRepository>());
    optionsStore.Load();
    FakeAudioService audioService;

    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::modules::chat::application::ChatService service(
        gateway, protocol, sessionStore, optionsStore, audioService);
    Expect(service.Open(), "Ouverture chat attendue");

    bool threw = false;
    try
    {
        service.Send("salut");
    }
    catch (const std::runtime_error& error)
    {
        threw = true;
        Expect(std::string(error.what()).find(lila::shared::errors::ChatSendFailed) != std::string::npos, "Erreur d'envoi attendue");
    }

    Expect(threw, "Envoi en echec devait lever");
    service.Close();
    executor.Shutdown();
    lila::shared::concurrency::UninstallBackgroundExecutor();

    std::cout << "[TEST PASSED] ChatServiceSendReportsTransportFailure\n";
}

void TestRoomSessionServiceReconnectsAndRepublishesState()
{
    lila::shared::concurrency::BackgroundExecutor executor({.workerCount = 3, .queueCapacity = 16});
    lila::shared::concurrency::InstallBackgroundExecutor(executor);

    FakeRoomSessionGateway gateway;
    lila::modules::rooms::application::RoomSessionService service(gateway);
    std::mutex eventsMutex;
    std::vector<lila::modules::rooms::domain::RoomEvent> receivedEvents;
    service.SetEventHandler(
        [&eventsMutex, &receivedEvents](lila::modules::rooms::domain::RoomEvent event)
        {
            std::scoped_lock lock(eventsMutex);
            receivedEvents.push_back(std::move(event));
        });

    const auto initial = service.Join(42, false, {});
    Expect(initial.id == 42, "Etat initial de table attendu");
    service.Start();
    gateway.TriggerReceiveFailure();

    WaitUntil(
        [&gateway]()
        {
            std::scoped_lock lock(gateway.mutex);
            return gateway.reconnectCount >= 1;
        },
        "Reconnexion de table attendue");
    WaitUntil(
        [&eventsMutex, &receivedEvents]()
        {
            std::scoped_lock lock(eventsMutex);
            return std::any_of(
                receivedEvents.begin(),
                receivedEvents.end(),
                [](const auto& event)
                {
                    return event.type == lila::modules::rooms::domain::RoomEventType::StateUpdated &&
                        event.room.has_value() && event.room->id == 42;
                });
        },
        "Etat de table republie apres reconnexion attendu");

    service.Close();
    executor.Shutdown();
    lila::shared::concurrency::UninstallBackgroundExecutor();
    std::cout << "[TEST PASSED] RoomSessionServiceReconnectsAndRepublishesState\n";
}

void TestAsyncRequestSlotRejectsStaleCompletion()
{
    lila::shared::concurrency::AsyncRequestSlot slot;
    const auto staleToken = slot.CurrentToken();
    auto staleSource = std::make_shared<std::stop_source>();
    auto staleTask = std::make_shared<lila::shared::concurrency::BackgroundTaskHandle>(staleSource);
    slot.Track(staleTask);
    slot.Cancel();

    Expect(staleTask->IsCancellationRequested(), "Requete precedente annulee attendue");
    Expect(!slot.Complete(staleToken), "Completion obsolete rejetee attendue");

    const auto currentToken = slot.CurrentToken();
    auto currentSource = std::make_shared<std::stop_source>();
    auto currentTask = std::make_shared<lila::shared::concurrency::BackgroundTaskHandle>(currentSource);
    slot.Track(currentTask);
    Expect(slot.Complete(currentToken), "Completion courante acceptee attendue");
    Expect(!currentTask->IsCancellationRequested(), "Requete terminee non annulee attendue");

    std::cout << "[TEST PASSED] AsyncRequestSlotRejectsStaleCompletion\n";
}

void TestSingleFlightCacheSharesLoadsAndSupportsInvalidation()
{
    lila::shared::cache::SingleFlightCache<int> cache;
    std::atomic<int> loadCount = 0;
    std::promise<void> loaderStarted;
    std::promise<void> releaseLoader;
    auto releaseFuture = releaseLoader.get_future().share();

    auto first = std::async(
        std::launch::async,
        [&]()
        {
            return cache.GetOrLoad(
                {},
                [&](std::stop_token)
                {
                    ++loadCount;
                    loaderStarted.set_value();
                    releaseFuture.wait();
                    return 42;
                });
        });
    loaderStarted.get_future().wait();
    auto second = std::async(
        std::launch::async,
        [&]()
        {
            return cache.GetOrLoad(
                {},
                [&](std::stop_token)
                {
                    ++loadCount;
                    return 99;
                });
        });

    releaseLoader.set_value();
    Expect(first.get() == 42, "Premiere valeur chargee attendue");
    Expect(second.get() == 42, "Chargement concurrent partage attendu");
    Expect(loadCount == 1, "Un seul chargement du cache attendu");
    Expect(cache.TryGet() == 42, "Lecture instantanee du cache attendue");

    cache.Clear();
    const auto refreshed = cache.GetOrLoad(
        {},
        [&](std::stop_token)
        {
            ++loadCount;
            return 7;
        });
    Expect(refreshed == 7 && loadCount == 2, "Rechargement apres invalidation attendu");

    std::cout << "[TEST PASSED] SingleFlightCacheSharesLoadsAndSupportsInvalidation\n";
}

int main()
{
    try
    {
        wxInitializer wx;
        Expect(wx.IsOk(), "Initialisation wxWidgets attendue");

        auto run = [](const char* name, auto&& test)
        {
            std::cout << "[RUNNING] " << name << '\n';
            std::cout.flush();
            test();
        };

        std::cout << "Running automated unit tests for client-wx...\n";
        std::cout.flush();
        run("SessionValidation", TestSessionValidation);
        run("JwtPayloadExpiration", TestJwtPayloadExpiration);
        run("OptionsStateNormalization", TestOptionsStateNormalization);
        run("DomainTypes", TestDomainTypes);
        run("SecurityWipe", TestSecurityWipe);
        run("JsonFileStorageRejectsOversizedFiles", TestJsonFileStorageRejectsOversizedFiles);
        run("JsonFileStorageRejectsCorruptedFiles", TestJsonFileStorageRejectsCorruptedFiles);
        run("OptionsCodecMigratesLegacyFieldsAndSchema", TestOptionsCodecMigratesLegacyFieldsAndSchema);
        run("SoundCatalogAndPerCueOptionsRoundTrip", TestSoundCatalogAndPerCueOptionsRoundTrip);
        run("AudioSettingsAndServiceRouting", TestAudioSettingsAndServiceRouting);
        run("SessionClearWipesRefreshToken", TestSessionClearWipesRefreshToken);
        run("SessionMovePreservesSecrets", TestSessionMovePreservesSecrets);
        run("SessionStoreRestoreLoadsPersistedSession", TestSessionStoreRestoreLoadsPersistedSession);
        run("SessionStoreRejectsSupersededConcurrentRefresh", TestSessionStoreRejectsSupersededConcurrentRefresh);
        run("AtomicFileWriterReplacesExistingContent", TestAtomicFileWriterReplacesExistingContent);
        run("EncodingRoundTripUnicode", TestEncodingRoundTripUnicode);
        run("EncodingRejectsInvalidUtf8", TestEncodingRejectsInvalidUtf8);
        run("BrokenAccentRepairCanBeToggled", TestBrokenAccentRepairCanBeToggled);
        run("RealtimeProtocolFallbackTypeAndPayloadValidation", TestRealtimeProtocolFallbackTypeAndPayloadValidation);
        run("ChatProtocolHandlesMalformedAndUnknownEvents", TestChatProtocolHandlesMalformedAndUnknownEvents);
        run("ChatMessageStoreEnforcesLimits", TestChatMessageStoreEnforcesLimits);
        run("ChatMessageActionRights", TestChatMessageActionRights);
        run("ActionButtonKeyboardSemantics", TestActionButtonKeyboardSemantics);
        run("NavigationControllerKeyboardSemantics", TestNavigationControllerKeyboardSemantics);
        run("CatalogPayloadCodecReadsShelfTree", TestCatalogPayloadCodecReadsShelfTree);
        run("CatalogShelfNavigatorRestoresParentSelection", TestCatalogShelfNavigatorRestoresParentSelection);
        run("RoomPayloadCodecs", TestRoomPayloadCodecs);
        run("RoomSessionGatewayUsesWpfHandshakeContract", TestRoomSessionGatewayUsesWpfHandshakeContract);
        run("RoomSessionServiceReconnectsAndRepublishesState", TestRoomSessionServiceReconnectsAndRepublishesState);
        run("AsyncRequestSlotRejectsStaleCompletion", TestAsyncRequestSlotRejectsStaleCompletion);
        run("SingleFlightCacheSharesLoadsAndSupportsInvalidation", TestSingleFlightCacheSharesLoadsAndSupportsInvalidation);
        run("RoomPresentationMatchesWpfWaitingTable", TestRoomPresentationMatchesWpfWaitingTable);
        run("VaultPayloadCodec", TestVaultPayloadCodec);
        run("RoomAndVaultPresentationState", TestRoomAndVaultPresentationState);
        run("StoryBookPayloadAndNavigation", TestStoryBookPayloadAndNavigation);
        run("LeaderboardPayloadAndNavigation", TestLeaderboardPayloadAndNavigation);
        run("EnsureSuccessOrThrowClearsExpiredSession", TestEnsureSuccessOrThrowClearsExpiredSession);
        run("ChatServiceCloseInterruptsReceiveLoop", TestChatServiceCloseInterruptsReceiveLoop);
        run("ChatServiceReconnectsAfterTransientFailure", TestChatServiceReconnectsAfterTransientFailure);
        run("ChatServiceSendReportsTransportFailure", TestChatServiceSendReportsTransportFailure);
        std::cout << "All tests completed successfully!\n";
        return 0;
    }
    catch (const std::exception& error)
    {
        std::cerr << "[TEST FAILED] " << error.what() << '\n';
        return 1;
    }
}
