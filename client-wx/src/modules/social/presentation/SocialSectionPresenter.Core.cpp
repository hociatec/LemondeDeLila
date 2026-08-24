#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <array>
#include <span>
#include <string>
#include <vector>

#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/window.h>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialSelectionMemory.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
namespace
{
template <typename T, typename Formatter>
void PopulateMenu(lila::shared::ui::controls::VerticalMenu& list, const std::vector<T>& items, Formatter formatter)
{
    std::vector<lila::shared::ui::controls::VerticalMenuItem> menuItems;
    menuItems.reserve(items.size());
    for (std::size_t index = 0; index < items.size(); ++index)
    {
        menuItems.push_back({std::to_string(index), formatter(items[index])});
    }
    list.SetItems(std::span<const lila::shared::ui::controls::VerticalMenuItem>{menuItems.data(), menuItems.size()});
}
}

SocialSectionPresenter::SocialSectionPresenter(
    wxWindow& owner,
    SocialView& view,
    SocialDataStore& dataStore,
    SocialNavigationState& navigationState,
    SocialSelectionMemory& selectionMemory) noexcept
    : owner_(owner),
      view_(view),
      dataStore_(dataStore),
      navigationState_(navigationState),
      selectionMemory_(selectionMemory)
{
}

void SocialSectionPresenter::PopulateSection(SocialSection section)
{
    const auto controls = view_.SectionFor(section);
    if (controls.list == nullptr)
    {
        return;
    }

    switch (section)
    {
    case SocialSection::Friends:
        PopulateMenu(*controls.list, dataStore_.Friends(), [](const domain::SocialUser& user)
        {
            return SocialPresentationModel::BuildUserLabel(user);
        });
        RestoreSelection(*controls.list, section);
        break;
    case SocialSection::IncomingRequests:
        PopulateMenu(*controls.list, dataStore_.IncomingRequests(), [](const domain::SocialFriendRequest& request)
        {
            return SocialPresentationModel::BuildRequestLabel(request, true);
        });
        RestoreSelection(*controls.list, section);
        break;
    case SocialSection::OutgoingRequests:
        PopulateMenu(*controls.list, dataStore_.OutgoingRequests(), [](const domain::SocialFriendRequest& request)
        {
            return SocialPresentationModel::BuildRequestLabel(request, false);
        });
        RestoreSelection(*controls.list, section);
        break;
    case SocialSection::Blocked:
        PopulateMenu(*controls.list, dataStore_.BlockedUsers(), [](const domain::SocialUser& user)
        {
            return SocialPresentationModel::BuildUserLabel(user);
        });
        RestoreSelection(*controls.list, section);
        break;
    case SocialSection::Profile:
        break;
    }
}

void SocialSectionPresenter::StoreSelection(SocialSection section)
{
    const auto controls = view_.SectionFor(section);
    auto* list = controls.list;
    if (section == SocialSection::Profile)
    {
        return;
    }

    selectionMemory_.Store(
        section,
        list != nullptr && list->GetItemCount() > 0
            ? std::optional<std::size_t>{list->GetSelectedIndex()}
            : std::nullopt);
}

void SocialSectionPresenter::RestoreSelection(
    lila::shared::ui::controls::VerticalMenu& list,
    SocialSection section)
{
    const auto selection = selectionMemory_.Restore(section, list.GetItemCount());
    if (selection.has_value())
    {
        list.SetSelectedIndexSilently(*selection);
    }
}

void SocialSectionPresenter::ShowOnlySectionPanel(wxWindow* targetPanel)
{
    if (view_.sectionBook == nullptr || targetPanel == nullptr)
    {
        return;
    }

    view_.sectionBook->SetSelection(static_cast<int>(SocialSectionIndex(navigationState_.currentSection)));
    view_.sectionBook->Layout();
    owner_.Layout();
}

void SocialSectionPresenter::ShowCurrentSection()
{
    const auto controls = view_.SectionFor(navigationState_.currentSection);
    ShowOnlySectionPanel(controls.panel);
    if (navigationState_.currentSection == SocialSection::Profile)
    {
        SyncProfileEditorVisibility();
    }
}
}
