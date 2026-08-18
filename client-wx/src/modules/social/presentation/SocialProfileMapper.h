#pragma once

#include <string>
#include <string_view>
#include <utility>

#include "modules/social/domain/SocialProfile.h"
#include "shared/contracts/BackendWsContracts.h"

namespace lila::modules::social::presentation
{
class SocialProfileMapper final
{
public:
    static int ChoiceIndexFromVisibility(std::string_view visibility) noexcept
    {
        if (visibility == lila::shared::contracts::social::SocialVisibilityFriends)
        {
            return 1;
        }
        if (visibility == lila::shared::contracts::social::SocialVisibilityPrivate)
        {
            return 2;
        }
        return 0;
    }

    static std::string VisibilityFromChoiceIndex(int choiceIndex)
    {
        switch (choiceIndex)
        {
        case 1:
            return std::string(lila::shared::contracts::social::SocialVisibilityFriends);
        case 2:
            return std::string(lila::shared::contracts::social::SocialVisibilityPrivate);
        default:
            return std::string(lila::shared::contracts::social::SocialVisibilityPublic);
        }
    }

    static domain::SocialProfileUpdate BuildUpdate(
        std::string bio,
        std::string victoryMessage,
        std::string defeatMessage,
        int visibilityChoiceIndex)
    {
        domain::SocialProfileUpdate update;
        update.bio = std::move(bio);
        update.victoryMessage = std::move(victoryMessage);
        update.defeatMessage = std::move(defeatMessage);
        update.visibility = VisibilityFromChoiceIndex(visibilityChoiceIndex);
        return update;
    }
};
}
