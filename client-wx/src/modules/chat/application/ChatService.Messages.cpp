#include "modules/chat/application/ChatService.h"

#include <algorithm>
#include <ctime>

#include "modules/session/application/SessionStore.h"
#include "modules/chat/infrastructure/ChatProtocol.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include <limits>
#include <sstream>

namespace lila::modules::chat::application
{
void ChatService::ProcessIncomingMessage(const std::string& rawJson, bool fatalError)
{
    int currentUserId = 0;
    const auto sessionUserId = sessionStore_.Current().userId.value;
    if (sessionUserId > static_cast<std::int64_t>(std::numeric_limits<int>::max()))
    {
        lila::shared::logging::LogWarning("Chat", "UserId hors plage int pour le protocole chat.");
    }
    else if (sessionUserId < static_cast<std::int64_t>(std::numeric_limits<int>::min()))
    {
        lila::shared::logging::LogWarning("Chat", "UserId negatif hors plage int pour le protocole chat.");
    }
    else
    {
        currentUserId = static_cast<int>(sessionUserId);
    }

    const auto event =
        protocol_.ParseEvent(rawJson, currentUserId, std::time(nullptr));

    switch (event.type)
    {
    case infrastructure::ChatEventType::Ignored:
        return;
    case infrastructure::ChatEventType::History:
        {
            messagesStore_.LoadHistory(std::move(event.messages), std::max(0, event.editWindowSeconds));
            NotifyMessagesChanged();
            std::ostringstream status;
            status << messagesStore_.Snapshot().size() << lila::shared::errors::ChatHistoryLoaded;
            SetStatus(status.str(), false);
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
            HandleIncomingError(event.error->message, &*event.error, fatalError);
        }
        return;
    }
}

void ChatService::HandleIncomingError(
    const std::string& message,
    const domain::ChatServerError* detailedError,
    bool fatalError)
{
    {
        std::scoped_lock lock(mutex_);
        lastServerError_ =
            detailedError != nullptr ? std::optional<domain::ChatServerError>(*detailedError) : std::nullopt;
    }
    if (fatalError)
    {
        SetState(domain::ChatState::Error);
    }
    const std::string statusMessage =
        message.empty() ? lila::shared::errors::ChatErrorMessage : message;
    lila::shared::logging::LogWarning("Chat", "Erreur reçue du serveur : " + statusMessage);
    SetStatus(statusMessage, true);
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
