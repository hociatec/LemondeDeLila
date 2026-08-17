#include "modules/messaging/application/MessagingService.h"

namespace lila::modules::messaging::application
{
MessagingService::MessagingService(IMessagingGateway& api)
    : api_(api)
{
}

std::vector<domain::MessagingMessage> MessagingService::LoadBox(domain::MessagingBox box, int limit) const
{
    return api_.GetBox(box, limit);
}

std::vector<domain::MessagingMessage> MessagingService::LoadConversation(int userId, int limit) const
{
    return api_.GetConversation(userId, limit);
}

std::optional<domain::MessagingMessage> MessagingService::Send(
    int recipientId,
    const std::string& text,
    const std::optional<std::string>& subject) const
{
    return api_.Send(recipientId, text, subject);
}

std::optional<domain::MessagingMessage> MessagingService::Delete(const std::string& messageId) const
{
    return api_.Delete(messageId);
}

std::optional<domain::MessagingMessage> MessagingService::Restore(const std::string& messageId) const
{
    return api_.Restore(messageId);
}

std::optional<domain::MessagingMessage> MessagingService::Purge(const std::string& messageId) const
{
    return api_.Purge(messageId);
}

std::optional<domain::MessagingUser> MessagingService::SearchUser(const std::string& query) const
{
    return api_.SearchUser(query);
}

void MessagingService::MarkRead(const std::string& messageId) const
{
    api_.MarkRead(messageId);
}
}
