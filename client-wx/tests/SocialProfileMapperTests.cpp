#include <cassert>
#include <string>

#include "modules/social/presentation/SocialProfileMapper.h"
#include "shared/contracts/BackendWsContracts.h"

using lila::modules::social::presentation::SocialProfileMapper;

int main()
{
    using namespace lila::shared::contracts::social;
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(SocialVisibilityPublic) == 0);
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(SocialVisibilityFriends) == 1);
    assert(SocialProfileMapper::ChoiceIndexFromVisibility(SocialVisibilityPrivate) == 2);
    assert(SocialProfileMapper::ChoiceIndexFromVisibility("unknown") == 0);

    assert(SocialProfileMapper::VisibilityFromChoiceIndex(0) == SocialVisibilityPublic);
    assert(SocialProfileMapper::VisibilityFromChoiceIndex(1) == SocialVisibilityFriends);
    assert(SocialProfileMapper::VisibilityFromChoiceIndex(2) == SocialVisibilityPrivate);
    assert(SocialProfileMapper::VisibilityFromChoiceIndex(99) == SocialVisibilityPublic);

    const auto update = SocialProfileMapper::BuildUpdate("bio", "victory", "defeat", 1);
    assert(update.bio == "bio");
    assert(update.victoryMessage == "victory");
    assert(update.defeatMessage == "defeat");
    assert(update.visibility == SocialVisibilityFriends);
    return 0;
}
