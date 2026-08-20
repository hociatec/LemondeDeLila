#pragma once

#include <functional>
#include <optional>
#include <string>

#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"

namespace lila::modules::messaging::presentation
{
class MessagingMailboxController;

class MessagingComposeController final
{
public:
    struct SendPayload final
    {
        std::string recipientName;
        std::optional<std::string> subject;
        std::string body;
    };

    struct Callbacks final
    {
        std::function<void(const char* busyMessage, std::function<void()> worker, std::function<void()> onSuccess)> runTask;
        std::function<void(const char* statusMessage, bool isError)> updateStatus;
        std::function<void(const char* confirmationTemplate, const std::string& recipientName)> showSuccess;
        std::function<void()> closeCompose;
        std::function<void()> refreshOutbox;
    };

    explicit MessagingComposeController(MessagingMailboxController& mailboxController, Callbacks callbacks);

    void Send(SendPayload payload) const;
    [[nodiscard]] static domain::MessagingUser ResolveReplyRecipient(const domain::MessagingMessage& message);

private:
    MessagingMailboxController& mailboxController_;
    Callbacks callbacks_;
};
}
