#include "modules/messaging/presentation/MessagingActionController.h"

#include <utility>

#include "modules/messaging/application/MessagingService.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::messaging::presentation
{
inline MessagingActionController::MessagingActionController(
    application::MessagingService& service,
    Callbacks callbacks)
    : service_(service), callbacks_(std::move(callbacks))
{
}

inline void MessagingActionController::Mutate(Mutation mutation, const std::string& messageId) const
{
    const char* confirmationText = nullptr;
    const char* busyText = nullptr;
    const char* successText = nullptr;
    bool warning = false;

    switch (mutation)
    {
    case Mutation::Delete:
        confirmationText = lila::shared::errors::MessagingDeleteConfirm;
        busyText = lila::shared::errors::MessagingDeleteBusy;
        successText = lila::shared::errors::MessagingDeletedMessage;
        break;
    case Mutation::Restore:
        busyText = lila::shared::errors::MessagingRestoreBusy;
        successText = lila::shared::errors::MessagingRestoredMessage;
        break;
    case Mutation::Purge:
        confirmationText = lila::shared::errors::MessagingPurgeConfirm;
        busyText = lila::shared::errors::MessagingPurgeBusy;
        successText = lila::shared::errors::MessagingPurgedMessage;
        warning = true;
        break;
    }

    if (confirmationText != nullptr && callbacks_.confirm && !callbacks_.confirm(confirmationText, warning))
    {
        return;
    }

    if (!callbacks_.runTask)
    {
        return;
    }

    auto* service = &service_;
    const auto callbacks = callbacks_;
    callbacks_.runTask(
        busyText,
        [service, mutation, messageId]()
        {
            switch (mutation)
            {
            case Mutation::Delete:
                static_cast<void>(service->Delete(messageId));
                return;
            case Mutation::Restore:
                static_cast<void>(service->Restore(messageId));
                return;
            case Mutation::Purge:
                static_cast<void>(service->Purge(messageId));
                return;
            }
        },
        [callbacks, successText]()
        {
            if (callbacks.showFeedback)
            {
                callbacks.showFeedback(successText);
            }
            if (callbacks.refreshCurrentBox)
            {
                callbacks.refreshCurrentBox();
            }
        });
}

inline void MessagingActionController::MarkRead(const std::string& messageId) const
{
    if (messageId.empty() || !callbacks_.runTask)
    {
        return;
    }

    auto* service = &service_;
    callbacks_.runTask(
        lila::shared::errors::MessagingMarkReadBusy,
        [service, messageId]()
        {
            service->MarkRead(messageId);
        },
        {});
}
}
