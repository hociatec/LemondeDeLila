#include "modules/social/presentation/SocialActionController.h"

#include <utility>

#include "modules/social/application/SocialService.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::social::presentation
{
SocialActionController::SocialActionController(
    application::SocialService& socialService,
    Callbacks callbacks)
    : socialService_(socialService),
      callbacks_(std::move(callbacks))
{
}

void SocialActionController::ActivateSectionAction(
    SocialSection section,
    SocialActionId actionId,
    std::optional<int> userId,
    bool isBlocked) const
{
    if (actionId == SocialActionId::ViewProfile)
    {
        OpenProfile(userId);
        return;
    }

    if (!userId.has_value())
    {
        return;
    }

    auto* service = &socialService_;
    switch (section)
    {
    case SocialSection::Friends:
        if (actionId == SocialActionId::RemoveFriend)
        {
            Schedule(
                lila::shared::text::ui::SocialProfileRemoveBusy,
                [service, id = *userId]() { service->RemoveFriend(id); },
                lila::shared::text::ui::SocialFriendRemoved,
                section);
            return;
        }
        if (actionId == SocialActionId::ToggleBlock)
        {
            ToggleBlock(*userId, isBlocked, section);
        }
        return;
    case SocialSection::IncomingRequests:
        if (actionId == SocialActionId::AcceptRequest)
        {
            Schedule(
                lila::shared::text::ui::SocialProfileAcceptBusy,
                [service, id = *userId]() { service->AcceptFriend(id); },
                lila::shared::text::ui::SocialProfileAccepted,
                section);
            return;
        }
        if (actionId == SocialActionId::RejectRequest)
        {
            Schedule(
                lila::shared::text::ui::SocialProfileRejectBusy,
                [service, id = *userId]() { service->RejectFriend(id); },
                lila::shared::text::ui::SocialProfileRejected,
                section);
            return;
        }
        if (actionId == SocialActionId::ToggleBlock)
        {
            ToggleBlock(*userId, isBlocked, section);
        }
        return;
    case SocialSection::OutgoingRequests:
        if (actionId == SocialActionId::CancelRequest)
        {
            Schedule(
                lila::shared::text::ui::SocialProfileCancelBusy,
                [service, id = *userId]() { service->CancelRequest(id); },
                lila::shared::text::ui::SocialProfileCanceled,
                section);
            return;
        }
        if (actionId == SocialActionId::ToggleBlock)
        {
            ToggleBlock(*userId, isBlocked, section);
        }
        return;
    case SocialSection::Blocked:
        if (actionId == SocialActionId::UnblockUser)
        {
            Schedule(
                lila::shared::text::ui::SocialProfileActionUnblocked,
                [service, id = *userId]() { service->UnblockUser(id); },
                lila::shared::text::ui::SocialProfileUnblocked,
                section);
        }
        return;
    case SocialSection::Profile:
        return;
    }
}

void SocialActionController::SaveProfile(
    domain::SocialProfileUpdate update,
    std::function<void(std::optional<domain::SocialProfile>)> onSaved) const
{
    if (!callbacks_.runTask)
    {
        return;
    }

    auto result = std::make_shared<std::optional<domain::SocialProfile>>();
    auto* service = &socialService_;
    callbacks_.runTask(
        lila::shared::text::ui::SocialSaveProfileBusy,
        [service, result, update = std::move(update)]()
        {
            *result = service->SaveProfile(update);
        },
        [result, onSaved = std::move(onSaved)]() mutable
        {
            if (onSaved)
            {
                onSaved(std::move(*result));
            }
        });
}

void SocialActionController::OpenProfile(std::optional<int> userId) const
{
    if (!userId.has_value())
    {
        if (callbacks_.selectionRequired)
        {
            callbacks_.selectionRequired();
        }
        return;
    }

    if (callbacks_.openProfile)
    {
        callbacks_.openProfile(*userId);
    }
}

void SocialActionController::ToggleBlock(
    int userId,
    bool isBlocked,
    SocialSection refreshSection) const
{
    auto* service = &socialService_;
    Schedule(
        isBlocked
            ? lila::shared::text::ui::SocialProfileActionUnblocked
            : lila::shared::text::ui::SocialProfileActionBlocked,
        [service, userId, isBlocked]()
        {
            if (isBlocked)
            {
                service->UnblockUser(userId);
            }
            else
            {
                service->BlockUser(userId);
            }
        },
        isBlocked
            ? lila::shared::text::ui::SocialProfileUnblocked
            : lila::shared::text::ui::SocialProfileBlocked,
        refreshSection);
}

void SocialActionController::Schedule(
    const char* busyMessage,
    std::function<void()> worker,
    const char* successMessage,
    SocialSection refreshSection) const
{
    if (!callbacks_.runTask)
    {
        return;
    }

    const auto showFeedback = callbacks_.showFeedback;
    const auto refresh = callbacks_.refreshSection;
    callbacks_.runTask(
        busyMessage,
        std::move(worker),
        [showFeedback, refresh, successMessage, refreshSection]()
        {
            if (showFeedback)
            {
                showFeedback(successMessage);
            }
            if (refresh)
            {
                refresh(refreshSection);
            }
        });
}
}
