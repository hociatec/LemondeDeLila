#pragma once

#include <optional>
#include <string>

#include "modules/presence/presentation/PresencePresentationModel.h"
#include "modules/social/domain/SocialProfile.h"

namespace lila::modules::messaging::application { class MessagingService; }
namespace lila::modules::social::application { class SocialService; }

namespace lila::modules::presence::presentation
{
class PresenceActionController final
{
public:
    PresenceActionController(
        lila::modules::social::application::SocialService& socialService,
        lila::modules::messaging::application::MessagingService& messagingService) noexcept;

    [[nodiscard]] PresenceSocialState LoadSocialState(int userId) const;
    void ExecuteSocialAction(const std::string& actionId, int userId) const;
    [[nodiscard]] std::optional<lila::modules::social::domain::SocialProfile> LoadBio(int userId) const;
    void SendPrivateMessage(int userId, const std::string& subject, const std::string& body) const;

private:
    lila::modules::social::application::SocialService& socialService_;
    lila::modules::messaging::application::MessagingService& messagingService_;
};
}
