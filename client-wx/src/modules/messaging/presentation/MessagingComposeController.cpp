#include "modules/messaging/presentation/MessagingComposeController.h"

#include <memory>
#include <stdexcept>
#include <utility>

#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"

namespace lila::modules::messaging::presentation
{
MessagingComposeController::MessagingComposeController(
    MessagingMailboxController& mailboxController,
    Callbacks callbacks)
    : mailboxController_(mailboxController),
      callbacks_(std::move(callbacks))
{
}

void MessagingComposeController::Send(SendPayload payload) const
{
    if (!callbacks_.runTask)
    {
        return;
    }

    auto result = std::make_shared<MessagingMailboxController::SendResult>();
    auto* mailbox = &mailboxController_;
    callbacks_.runTask(
        lila::shared::text::ui::MessagingSendBusy.data(),
        [mailbox, result, payload = std::move(payload)]() mutable
        {
            *result = mailbox->SendToUser(
                std::move(payload.recipientName),
                std::move(payload.body),
                std::move(payload.subject));
            if (!result->recipient.has_value())
            {
                throw std::runtime_error(lila::shared::errors::MessagingRecipientNotFound);
            }
        },
        [this, result]()
        {
            if (!result->recipient.has_value() || !result->message.has_value())
            {
                if (callbacks_.updateStatus)
                {
                    callbacks_.updateStatus(lila::shared::errors::MessagingSendFailed, true);
                }
                return;
            }

            if (callbacks_.showSuccess)
            {
                callbacks_.showSuccess(
                    lila::shared::text::ui::MessagingSentToUser.data(),
                    result->recipient->username);
            }
            if (callbacks_.closeCompose)
            {
                callbacks_.closeCompose();
            }
            if (callbacks_.refreshOutbox)
            {
                callbacks_.refreshOutbox();
            }
        });
}

domain::MessagingUser MessagingComposeController::ResolveReplyRecipient(const domain::MessagingMessage& message)
{
    return message.isSent ? message.recipient : message.sender;
}
}
