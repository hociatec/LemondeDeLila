#include <cassert>
#include <string>

#include "modules/social/presentation/SocialProfileMapper.h"

using lila::modules::social::presentation::SocialProfileMapper;
using lila::shared::domain::ProfileVisibility;

int main()
{
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(ProfileVisibility::Public) == 0);
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(ProfileVisibility::Friends) == 1);
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(ProfileVisibility::Private) == 2);
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(static_cast<ProfileVisibility>(99)) == 0);

    assert(SocialProfileMapper::VisibilityFromChoiceIndex(0) == ProfileVisibility::Public);
    assert(SocialProfileMapper::VisibilityFromChoiceIndex(1) == ProfileVisibility::Friends);
    assert(SocialProfileMapper::VisibilityFromChoiceIndex(2) == ProfileVisibility::Private);
    assert(SocialProfileMapper::VisibilityFromChoiceIndex(99) == ProfileVisibility::Public);

    const auto update = SocialProfileMapper::BuildUpdate("bio", "victory", "defeat", 1);
    assert(update.bio == "bio");
    assert(update.victoryMessage == "victory");
    assert(update.defeatMessage == "defeat");
    assert(update.visibility == ProfileVisibility::Friends);
    return 0;
}
