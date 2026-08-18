#pragma once

#include <optional>
#include <string>
#include <vector>

#include "modules/messaging/application/MessagingService.h"
#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"

namespace lila::modules::messaging::presentation
{
class MessagingMailboxController final
{
public:
    struct SendResult final
    {
        std::optional<domain::MessagingUser> recipient;
        std::optional<domain::MessagingMessage> message;
    };

    explicit MessagingMailboxController(application::MessagingService& service) noexcept
        : service_(service)
    {
    }

    [[nodiscard]] std::vector<domain::MessagingMessage> LoadBox(domain::MessagingBox box) const
    {
        return service_.LoadBox(box);
    }

    [[nodiscard]] SendResult SendToUser(
        const std::string& username,
        const std::string& body,
        const std::optional<std::string>& subject) const
    {
        SendResult result;
        result.recipient = service_.SearchUser(username);
        if (!result.recipient.has_value())
        {
            return result;
        }

        result.message = service_.Send(result.recipient->id, body, subject);
        return result;
    }

private:
    application::MessagingService& service_;
};
}
