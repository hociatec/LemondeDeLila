#include "modules/chat/application/ChatService.h"

#include <algorithm>
#include <ctime>

#include "modules/session/application/SessionStore.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::chat::application
{
void ChatService::ProcessIncomingMessage(const std::string& rawJson)
{
    const auto event =
        protocol_.ParseEvent(rawJson, sessionStore_.Current().userId, std::time(nullptr));

    switch (event.type)
    {
    case infrastructure::ChatEventType::Ignored:
        return;
    case infrastructure::ChatEventType::History:
        {
            messagesStore_.LoadHistory(std::move(event.messages), std::max(0, event.editWindowSeconds));
            NotifyMessagesChanged();
            SetStatus(std::to_string(messagesStore_.Snapshot().size()) + " résultats chargés.", false);
            return;
        }
    case infrastructure::ChatEventType::MessageUpserted:
        for (const auto& message : event.messages)
        {
            UpsertMessage(message);
        }
        NotifyMessagesChanged();
        return;
    case infrastructure::ChatEventType::MessageDeleted:
        RemoveMessageById(event.deletedMessageId);
        NotifyMessagesChanged();
        return;
    case infrastructure::ChatEventType::Error:
        if (event.error.has_value())
        {
            HandleIncomingError(event.error->message, &*event.error);
        }
        return;
    }
}

void ChatService::HandleIncomingError(const std::string& message, const domain::ChatServerError* detailedError)
{
    {
        std::scoped_lock lock(mutex_);
        lastServerError_ =
            detailedError != nullptr ? std::optional<domain::ChatServerError>(*detailedError) : std::nullopt;
    }
    SetState(domain::ChatState::Error);
    SetStatus(message.empty() ? lila::shared::errors::ChatErrorMessage : message, true);
}

void ChatService::UpsertMessage(domain::ChatMessage message)
{
    if (message.text.empty())
    {
        return;
    }

    messagesStore_.UpsertMessage(std::move(message));
}

void ChatService::RemoveMessageById(const std::string& messageId)
{
    messagesStore_.RemoveMessageById(messageId);
}
}
