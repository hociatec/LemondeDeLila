#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"

namespace lila::modules::messaging::application
{
class IMessagingGateway
{
public:
    virtual ~IMessagingGateway() = default;
    [[nodiscard]] virtual std::vector<domain::MessagingMessage> GetBox(domain::MessagingBox box, int limit) const = 0;
    [[nodiscard]] virtual std::optional<domain::MessagingMessage> Send(int recipientId, const std::string& text, const std::optional<std::string>& subject) const = 0;
    [[nodiscard]] virtual std::optional<domain::MessagingMessage> Delete(const std::string& messageId) const = 0;
    [[nodiscard]] virtual std::optional<domain::MessagingMessage> Restore(const std::string& messageId) const = 0;
    [[nodiscard]] virtual std::optional<domain::MessagingMessage> Purge(const std::string& messageId) const = 0;
    [[nodiscard]] virtual std::optional<domain::MessagingUser> SearchUser(const std::string& query) const = 0;
    virtual void MarkRead(const std::string& messageId) const = 0;
};
}
