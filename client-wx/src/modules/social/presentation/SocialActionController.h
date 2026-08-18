#pragma once

#include <cstddef>
#include <functional>
#include <optional>
#include <memory>

#include "modules/social/presentation/SocialSection.h"
#include "modules/social/domain/SocialProfile.h"

namespace lila::modules::social::application
{
class SocialService;
}

namespace lila::modules::social::presentation
{
class SocialActionController final
{
public:
    struct Callbacks final
    {
        std::function<void(const char* busyMessage, std::function<void()> worker, std::function<void()> onSuccess)> runTask;
        std::function<void(int userId)> openProfile;
        std::function<void()> selectionRequired;
        std::function<void(const char* message)> showFeedback;
        std::function<void(SocialSection section)> refreshSection;
    };

    SocialActionController(
        application::SocialService& socialService,
        Callbacks callbacks);

    void ActivateFriend(std::size_t actionIndex, std::optional<int> userId, bool isBlocked) const;
    void ActivateIncomingRequest(std::size_t actionIndex, std::optional<int> userId, bool isBlocked) const;
    void ActivateOutgoingRequest(std::size_t actionIndex, std::optional<int> userId, bool isBlocked) const;
    void ActivateBlockedUser(std::size_t actionIndex, std::optional<int> userId) const;
    void SaveProfile(
        domain::SocialProfileUpdate update,
        std::function<void(std::optional<domain::SocialProfile>)> onSaved) const;

private:
    void OpenProfile(std::optional<int> userId) const;
    void ToggleBlock(int userId, bool isBlocked, SocialSection refreshSection) const;
    void Schedule(
        const char* busyMessage,
        std::function<void()> worker,
        const char* successMessage,
        SocialSection refreshSection) const;

    application::SocialService& socialService_;
    Callbacks callbacks_;
};
}
