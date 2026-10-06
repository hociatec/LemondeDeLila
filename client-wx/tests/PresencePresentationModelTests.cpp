#include <cassert>
#include <algorithm>
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
    assert(std::any_of(friendActions.begin(), friendActions.end(),
        [](const auto& item) { return item.id == "storybook"; }));

    const auto otherPlayerActions = PresencePresentationModel::BuildActionItems({
        .relationshipAvailable = true,
        .isFriend = false,
    });
    assert(otherPlayerActions.front().id == "friend.add");

    const auto selfActions = PresencePresentationModel::BuildSelfActionItems();
    assert(selfActions.front().id == "storybook");
    assert(selfActions.front().label == wxString(L"Mon livre des contes"));
    assert(std::any_of(selfActions.begin(), selfActions.end(),
        [](const auto& item) { return item.id == "social.friends"; }));
    assert(std::none_of(selfActions.begin(), selfActions.end(),
        [](const auto& item) { return item.id.starts_with("friend."); }));
    assert(std::none_of(selfActions.begin(), selfActions.end(),
        [](const auto& item) { return item.label.StartsWith(L"Voir"); }));

    const auto unavailableActions = PresencePresentationModel::BuildActionItems({
        .relationshipAvailable = false,
    });
    assert(!unavailableActions.empty());
    assert(unavailableActions.front().id == "storybook");
}
