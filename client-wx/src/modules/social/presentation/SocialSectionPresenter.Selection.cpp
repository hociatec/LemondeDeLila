#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <span>
#include <vector>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
using MenuItem = lila::shared::ui::controls::VerticalMenuItem;

struct SectionSelectionState final
{
    bool hasItems = false;
    bool showActionMenu = false;
    std::vector<MenuItem> actionItems;
};

void SetActionMenuItems(
    lila::shared::ui::controls::VerticalMenu* menu,
    bool visible,
    std::span<const MenuItem> items)
{
    if (menu == nullptr)
    {
        return;
    }

    if (!visible)
    {
        menu->SetItems({});
        menu->Show(false);
        return;
    }

    const auto selected = menu->GetSelectedIndex();
    menu->SetItems(items);
    if (selected < menu->GetItemCount())
    {
        menu->SetSelectedIndexSilently(selected);
    }
    menu->Show(true);
}

MenuItem BuildToggleBlockItem(const char* id, bool blocked)
{
    return MenuItem{
        id,
        blocked
            ? lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionUnblock)
            : lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionBlock)};
}

std::vector<MenuItem> BuildActionItems(
    SocialSection section,
    const SocialDataStore& dataStore,
    const SocialView& view)
{
    switch (section)
    {
    case SocialSection::Friends:
    {
        const auto controls = view.FriendsSection();
        const auto& friends = dataStore.Friends();
        const std::size_t selection = controls.list != nullptr ? controls.list->GetSelectedIndex() : 0;
        const bool blocked = selection < friends.size() && dataStore.IsBlocked(friends[selection].id);
        return {
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView)},
            {"remove-friend", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionRemoveFriend)},
            BuildToggleBlockItem("block-friend", blocked),
        };
    }
    case SocialSection::IncomingRequests:
    {
        const auto controls = view.IncomingSection();
        const auto& incoming = dataStore.IncomingRequests();
        const std::size_t selection = controls.list != nullptr ? controls.list->GetSelectedIndex() : 0;
        const bool blocked = selection < incoming.size() && dataStore.IsBlocked(incoming[selection].requester.id);
        return {
            {"accept-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionAccept)},
            {"reject-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionReject)},
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView)},
            BuildToggleBlockItem("block-user", blocked),
        };
    }
    case SocialSection::OutgoingRequests:
    {
        const auto controls = view.OutgoingSection();
        const auto& outgoing = dataStore.OutgoingRequests();
        const std::size_t selection = controls.list != nullptr ? controls.list->GetSelectedIndex() : 0;
        const bool blocked = selection < outgoing.size() && dataStore.IsBlocked(outgoing[selection].addressee.id);
        return {
            {"cancel-request", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionCancel)},
            {"view-profile", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionView)},
            BuildToggleBlockItem("block-user", blocked),
        };
    }
    case SocialSection::Blocked:
        return {
            {"unblock-user", lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileActionUnblock)},
        };
    case SocialSection::Profile:
        return {};
    }

    return {};
}

SectionSelectionState BuildSelectionState(
    SocialSection section,
    const SocialDataStore& dataStore,
    const SocialNavigationState& navigationState,
    const SocialView& view)
{
    const auto controls = view.SectionFor(section);
    if (controls.list == nullptr)
    {
        return {};
    }

    const bool hasItems = controls.list->GetItemCount() > 0;
    return SectionSelectionState{
        hasItems,
        navigationState.currentSection == section &&
            navigationState.sectionActionMenuActive &&
            hasItems,
        BuildActionItems(section, dataStore, view)};
}
}

void SocialSectionPresenter::SyncSectionActionVisibility()
{
    for (const auto section : {SocialSection::Friends, SocialSection::IncomingRequests, SocialSection::OutgoingRequests, SocialSection::Blocked})
    {
        const auto controls = view_.SectionFor(section);
        if (controls.actionsMenu == nullptr || controls.list == nullptr)
        {
            continue;
        }

        controls.actionsMenu->Show(BuildSelectionState(section, dataStore_, navigationState_, view_).showActionMenu);
    }
}

void SocialSectionPresenter::SyncSelectionState()
{
    for (const auto section : {SocialSection::Friends, SocialSection::IncomingRequests, SocialSection::OutgoingRequests, SocialSection::Blocked})
    {
        const auto controls = view_.SectionFor(section);
        if (controls.list == nullptr || controls.emptyControl == nullptr)
        {
            continue;
        }

        const auto state = BuildSelectionState(section, dataStore_, navigationState_, view_);
        controls.list->Show(state.hasItems);
        controls.emptyControl->Show(!state.hasItems);
        SetActionMenuItems(controls.actionsMenu, state.showActionMenu, state.actionItems);

        if (controls.panel != nullptr)
        {
            controls.panel->Layout();
        }
    }
}

std::optional<int> SocialSectionPresenter::GetSelectedUserId() const
{
    if (navigationState_.currentSection == SocialSection::Profile)
    {
        return navigationState_.profileTargetUserId.has_value()
            ? navigationState_.profileTargetUserId
            : dataStore_.UserIdAt(SocialSection::Profile, 0);
    }

    const auto controls = view_.SectionFor(navigationState_.currentSection);
    auto* list = controls.list;
    if (list == nullptr || list->GetItemCount() == 0)
    {
        return std::nullopt;
    }
    return dataStore_.UserIdAt(navigationState_.currentSection, list->GetSelectedIndex());
}
}
