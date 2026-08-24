#pragma once

#include <functional>
#include <mutex>
#include <optional>
#include <string>
#include <memory>
#include <vector>

#include "modules/chat/application/ChatMessageStore.h"
#include "modules/chat/domain/ChatMessage.h"
#include "modules/chat/domain/ChatServerError.h"
#include "modules/chat/domain/ChatState.h"
#include "modules/chat/application/IChatGateway.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::audio::application
{
class IAudioService;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::chat::infrastructure
{
class IChatProtocol;
}

namespace lila::modules::chat::application
{
class ChatService final
{
public:
    struct EventHandlers final
    {
        std::function<void(const std::string& message, bool isError)> onStatusChanged;
        std::function<void()> onMessagesChanged;
    };

    ChatService(
        IChatGateway& gateway,
        lila::modules::chat::infrastructure::IChatProtocol& protocol,
        lila::modules::session::application::SessionStore& sessionStore,
        lila::modules::options::application::OptionsStore& optionsStore,
        lila::modules::audio::application::IAudioService& audioService);
    ~ChatService();

    bool Open();
    void Close();
    void Send(const std::string& text);
    void Edit(const std::string& messageId, const std::string& text);
    void Delete(const std::string& messageId);

    void AttachEventHandlers(std::shared_ptr<EventHandlers> handlers);

    [[nodiscard]] std::vector<domain::ChatMessage> Messages() const;
    [[nodiscard]] std::string StatusMessage() const;
    [[nodiscard]] domain::ChatState State() const;
    [[nodiscard]] int EditWindowSeconds() const;
    [[nodiscard]] std::optional<domain::ChatServerError> LastServerError() const;

private:
    void StopReceiveLoop() noexcept;
    void StartReceiveLoop();
    void ReceiveLoop(std::stop_token stopToken);
    void ProcessIncomingMessage(const std::string& rawJson, bool fatalError);
    void HandleIncomingError(
        const std::string& message,
        const domain::ChatServerError* detailedError,
        bool fatalError);
    void UpsertMessage(domain::ChatMessage message);
    void RemoveMessageById(const std::string& messageId);
    void SetState(domain::ChatState state);
    void SetStatus(std::string message, bool isError);
    void NotifyMessagesChanged();
    void SendRawJson(const std::string& payload);
    void OpenGateway(std::stop_token stopToken = {});

    IChatGateway& gateway_;
    lila::modules::chat::infrastructure::IChatProtocol& protocol_;
    lila::modules::session::application::SessionStore& sessionStore_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    lila::modules::audio::application::IAudioService& audioService_;
    mutable std::mutex mutex_;
    ChatMessageStore messagesStore_;
    std::string statusMessage_ = lila::shared::errors::ChatClosed;
    domain::ChatState state_ = domain::ChatState::Disconnected;
    std::optional<domain::ChatServerError> lastServerError_;
    std::weak_ptr<EventHandlers> eventHandlers_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> receiveTask_;
    int reconnectAttempt_ = 0;
};
}
