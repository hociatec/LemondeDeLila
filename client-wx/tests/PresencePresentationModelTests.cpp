#include <cassert>
#include <string>

#include "modules/presence/presentation/PresencePresentationModel.h"

int main()
{
    using lila::modules::presence::presentation::PresencePresentationModel;
    using lila::modules::presence::presentation::PresenceSocialState;

    const auto friendActions = PresencePresentationModel::BuildActionItems({
        .relationshipAvailable = true,
        .isFriend = true,
    });
    assert(!friendActions.empty());
    assert(friendActions.front().id == "friend.remove");
    assert(friendActions.front().label == wxString(L"Retirer de mes amis"));

    const auto unavailableActions = PresencePresentationModel::BuildActionItems({
        .relationshipAvailable = false,
    });
    assert(!unavailableActions.empty());
    assert(unavailableActions.front().id == "storybook");
}
