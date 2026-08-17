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

void ChatService::SetStatusChangedHandler(StatusChangedHandler handler)
{
    std::scoped_lock lock(mutex_);
    onStatusChanged_ = std::move(handler);
}

void ChatService::SetMessagesChangedHandler(MessagesChangedHandler handler)
{
    std::scoped_lock lock(mutex_);
    onMessagesChanged_ = std::move(handler);
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
    StatusChangedHandler handler;
    std::string deliveredMessage;
    {
        std::scoped_lock lock(mutex_);
        statusMessage_ = std::move(message);
        deliveredMessage = statusMessage_;
        handler = onStatusChanged_;
    }

    if (handler)
    {
        handler(deliveredMessage, isError);
    }
}

void ChatService::NotifyMessagesChanged()
{
    MessagesChangedHandler handler;
    {
        std::scoped_lock lock(mutex_);
        handler = onMessagesChanged_;
    }

    if (handler)
    {
        handler();
    }
}
}
