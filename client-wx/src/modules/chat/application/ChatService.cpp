#include "modules/chat/application/ChatService.h"

#include <utility>

#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"

namespace lila::modules::chat::application
{
ChatService::ChatService(
    IChatGateway& gateway,
    lila::modules::chat::infrastructure::IChatProtocol& protocol,
    lila::modules::session::application::SessionStore& sessionStore,
    lila::modules::options::application::OptionsStore& optionsStore)
    : gateway_(gateway),
      protocol_(protocol),
      sessionStore_(sessionStore),
      optionsStore_(optionsStore)
{
}

ChatService::~ChatService()
{
    Close();
}

void ChatService::AttachEventHandlers(std::shared_ptr<EventHandlers> handlers)
{
    std::scoped_lock lock(mutex_);
    eventHandlers_ = std::move(handlers);
}

std::vector<domain::ChatMessage> ChatService::Messages() const
{
    return messagesStore_.Snapshot();
}

std::string ChatService::StatusMessage() const
{
    std::scoped_lock lock(mutex_);
    return statusMessage_;
}

domain::ChatState ChatService::State() const
{
    std::scoped_lock lock(mutex_);
    return state_;
}

int ChatService::EditWindowSeconds() const
{
    return messagesStore_.EditWindowSeconds();
}

std::optional<domain::ChatServerError> ChatService::LastServerError() const
{
    std::scoped_lock lock(mutex_);
    return lastServerError_;
}

void ChatService::SetState(domain::ChatState state)
{
    std::scoped_lock lock(mutex_);
    state_ = state;
}

void ChatService::SetStatus(std::string message, bool isError)
{
    std::shared_ptr<EventHandlers> handlers;
    std::string deliveredMessage;
    {
        std::scoped_lock lock(mutex_);
        statusMessage_ = std::move(message);
        deliveredMessage = statusMessage_;
        handlers = eventHandlers_.lock();
    }

    if (handlers && handlers->onStatusChanged)
    {
        handlers->onStatusChanged(deliveredMessage, isError);
    }
}

void ChatService::NotifyMessagesChanged()
{
    std::shared_ptr<EventHandlers> handlers;
    {
        std::scoped_lock lock(mutex_);
        handlers = eventHandlers_.lock();
    }

    if (handlers && handlers->onMessagesChanged)
    {
        handlers->onMessagesChanged();
    }
}
}
