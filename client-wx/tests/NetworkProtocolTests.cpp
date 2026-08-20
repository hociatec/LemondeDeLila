#include <iostream>
#include <cassert>
#include <filesystem>
#include <fstream>
#include <chrono>
#include <deque>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <stdexcept>
#include <string>
#include <vector>

#include <wx/init.h>
#include "modules/chat/application/ChatService.h"
#include "modules/chat/application/ChatMessageStore.h"
#include "modules/chat/application/IChatGateway.h"
#include "modules/chat/domain/ChatMessage.h"
#include "modules/chat/domain/ChatState.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/presentation/ChatMessageActions.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/domain/IOptionsRepository.h"
#include "modules/options/domain/OptionsState.h"
#include "modules/options/infrastructure/OptionsJsonDocumentCodec.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/ISessionRepository.h"
#include "modules/session/domain/Session.h"
#include "shared/accessibility/ActionButton.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/domain/DomainTypes.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiHelpers.h"
#include "shared/network/realtime/RealtimeProtocol.h"
#include "shared/persistence/AtomicFileWriter.h"
#include "shared/persistence/JsonFileStorage.h"
#include "shared/security/SecurityUtils.h"
#include "shared/text/Encoding.h"

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
    Expect(!serialized.contains("confirmLogout"), "confirmLogout legacy ne doit plus etre serialise");
    Expect(serialized.at("currentVersion") == "1.2.3", "currentVersion top-level attendue");
    Expect(serialized.at("runtime").at("currentVersion") == "1.2.3", "currentVersion runtime attendue");
    Expect(
        serialized.at("internal").at("admin").at("adminChatModerationLoadLimit") == 200,
        "Limite admin serialisee inattendue");

    std::cout << "[TEST PASSED] OptionsCodecMigratesLegacyFieldsAndSchema\n";
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

void TestRealtimeProtocolFallbackTypeAndPayloadValidation()
{
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

    Expect(ActionButton::ShouldPreserveArrowNavigation(WXK_UP), "Fleche haut doit preservER la navigation");
    Expect(ActionButton::ShouldPreserveArrowNavigation(WXK_NUMPAD_DOWN), "Fleche bas pave numerique doit preserver la navigation");
    Expect(!ActionButton::ShouldPreserveArrowNavigation(WXK_TAB), "Tab ne doit pas etre traite comme fleche");

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

    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::modules::chat::application::ChatService service(gateway, protocol, sessionStore, optionsStore);
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

    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::modules::chat::application::ChatService service(gateway, protocol, sessionStore, optionsStore);
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

    lila::modules::session::domain::Session session;
    session.userId = lila::shared::domain::UserId{7};
    session.username = "alice";
    session.token = "header.payload.signature";
    session.expiresAt = 4102444800LL;
    sessionStore.Open(session, false);

    lila::modules::chat::application::ChatService service(gateway, protocol, sessionStore, optionsStore);
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
        run("OptionsStateNormalization", TestOptionsStateNormalization);
        run("DomainTypes", TestDomainTypes);
        run("SecurityWipe", TestSecurityWipe);
        run("JsonFileStorageRejectsOversizedFiles", TestJsonFileStorageRejectsOversizedFiles);
        run("JsonFileStorageRejectsCorruptedFiles", TestJsonFileStorageRejectsCorruptedFiles);
        run("OptionsCodecMigratesLegacyFieldsAndSchema", TestOptionsCodecMigratesLegacyFieldsAndSchema);
        run("SessionClearWipesRefreshToken", TestSessionClearWipesRefreshToken);
        run("SessionMovePreservesSecrets", TestSessionMovePreservesSecrets);
        run("SessionStoreRestoreLoadsPersistedSession", TestSessionStoreRestoreLoadsPersistedSession);
        run("AtomicFileWriterReplacesExistingContent", TestAtomicFileWriterReplacesExistingContent);
        run("EncodingRoundTripUnicode", TestEncodingRoundTripUnicode);
        run("EncodingRejectsInvalidUtf8", TestEncodingRejectsInvalidUtf8);
        run("RealtimeProtocolFallbackTypeAndPayloadValidation", TestRealtimeProtocolFallbackTypeAndPayloadValidation);
        run("ChatProtocolHandlesMalformedAndUnknownEvents", TestChatProtocolHandlesMalformedAndUnknownEvents);
        run("ChatMessageStoreEnforcesLimits", TestChatMessageStoreEnforcesLimits);
        run("ChatMessageActionRights", TestChatMessageActionRights);
        run("ActionButtonKeyboardSemantics", TestActionButtonKeyboardSemantics);
        run("NavigationControllerKeyboardSemantics", TestNavigationControllerKeyboardSemantics);
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
