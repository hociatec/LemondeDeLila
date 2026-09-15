#include "modules/presence/presentation/PresenceActionController.h"

#include "modules/messaging/application/MessagingService.h"
#include "modules/social/application/SocialService.h"

namespace lila::modules::presence::presentation
{
PresenceActionController::PresenceActionController(
    lila::modules::social::application::SocialService& socialService,
    lila::modules::messaging::application::MessagingService& messagingService) noexcept
    : socialService_(socialService),
      messagingService_(messagingService)
{
}

PresenceSocialState PresenceActionController::LoadSocialState(int userId) const
{
    const auto state = socialService_.LoadRelationshipState(userId);
    return {
        true,
        state.isFriend,
        state.isBlocked,
        state.blockedByTarget,
        state.outgoingRequest,
        state.incomingRequest,
    };
}

void PresenceActionController::ExecuteSocialAction(const std::string& actionId, int userId) const
{
    if (actionId == "block")
    {
        socialService_.BlockUser(userId);
    }
    else if (actionId == "unblock")
    {
        socialService_.UnblockUser(userId);
    }
    else if (actionId == "friend.add")
    {
        socialService_.RequestFriend(userId);
    }
    else if (actionId == "friend.remove")
    {
        socialService_.RemoveFriend(userId);
    }
    else if (actionId == "friend.accept")
    {
        socialService_.AcceptFriend(userId);
    }
    else if (actionId == "friend.reject")
    {
        socialService_.RejectFriend(userId);
    }
    else if (actionId == "friend.cancel")
    {
        socialService_.CancelRequest(userId);
    }
}

std::optional<lila::modules::social::domain::SocialProfile> PresenceActionController::LoadBio(int userId) const
{
    return socialService_.LoadProfile(userId);
}

void PresenceActionController::SendPrivateMessage(int userId, const std::string& subject, const std::string& body) const
{
    static_cast<void>(messagingService_.Send(userId, body, subject.empty() ? std::nullopt : std::optional<std::string>{subject}));
}
}
