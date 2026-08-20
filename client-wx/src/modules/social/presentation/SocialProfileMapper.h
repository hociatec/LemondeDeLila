#pragma once

#include <utility>

#include "modules/social/domain/SocialProfile.h"

namespace lila::modules::social::presentation
{
class SocialProfileMapper final
{
public:
    static int ChoiceIndexFromVisibility(lila::shared::domain::ProfileVisibility visibility) noexcept
    {
        if (visibility == lila::shared::domain::ProfileVisibility::Friends)
        {
            return 1;
        }
        if (visibility == lila::shared::domain::ProfileVisibility::Private)
        {
            return 2;
        }
        return 0;
    }

    static lila::shared::domain::ProfileVisibility VisibilityFromChoiceIndex(int choiceIndex)
    {
        switch (choiceIndex)
        {
        case 1:
            return lila::shared::domain::ProfileVisibility::Friends;
        case 2:
            return lila::shared::domain::ProfileVisibility::Private;
        default:
            return lila::shared::domain::ProfileVisibility::Public;
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
