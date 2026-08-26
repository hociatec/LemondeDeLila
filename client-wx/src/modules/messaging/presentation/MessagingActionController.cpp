#include "modules/messaging/presentation/MessagingActionController.h"

#include <utility>

#include "modules/messaging/application/MessagingService.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::messaging::presentation
{
MessagingActionController::MessagingActionController(
    application::MessagingService& service,
    Callbacks callbacks)
    : service_(service), callbacks_(std::move(callbacks))
{
}

void MessagingActionController::Mutate(Mutation mutation, const std::string& messageId) const
{
    const char* confirmationText = nullptr;
    const char* busyText = nullptr;
    const char* successText = nullptr;
    bool warning = false;

    switch (mutation)
    {
    case Mutation::Delete:
        confirmationText = lila::shared::text::ui::MessagingDeleteConfirm.data();
        busyText = lila::shared::text::ui::MessagingDeleteBusy.data();
        successText = lila::shared::text::ui::MessagingDeletedMessage.data();
        break;
    case Mutation::Restore:
        busyText = lila::shared::text::ui::MessagingRestoreBusy.data();
        successText = lila::shared::text::ui::MessagingRestoredMessage.data();
        break;
    case Mutation::Purge:
        confirmationText = lila::shared::text::ui::MessagingPurgeConfirm.data();
        busyText = lila::shared::text::ui::MessagingPurgeBusy.data();
        successText = lila::shared::text::ui::MessagingPurgedMessage.data();
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

void MessagingActionController::MarkRead(const std::string& messageId) const
{
    if (messageId.empty() || !callbacks_.runTask)
    {
        return;
    }

    auto* service = &service_;
    callbacks_.runTask(
        lila::shared::text::ui::MessagingMarkReadBusy.data(),
        [service, messageId]()
        {
            service->MarkRead(messageId);
        },
        {});
}
}
