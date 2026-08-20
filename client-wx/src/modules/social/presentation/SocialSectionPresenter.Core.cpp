#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialSectionPresenter.h"

#include <array>
#include <span>
#include <string>
#include <vector>

#include <wx/frame.h>
#include <wx/panel.h>
#include <wx/simplebook.h>

#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialSelectionMemory.h"
#include "modules/social/presentation/SocialView.h"
#include "shared/ui/controls/VerticalMenu.h"

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
    wxFrame& owner,
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
    switch (section)
    {
    case SocialSection::Friends:
        PopulateMenu(*view_.friendsList, dataStore_.Friends(), [](const domain::SocialUser& user)
        {
            return SocialPresentationModel::BuildUserLabel(user);
        });
        RestoreSelection(*view_.friendsList, section);
        break;
    case SocialSection::IncomingRequests:
        PopulateMenu(*view_.incomingRequestsList, dataStore_.IncomingRequests(), [](const domain::SocialFriendRequest& request)
        {
            return SocialPresentationModel::BuildRequestLabel(request, true);
        });
        RestoreSelection(*view_.incomingRequestsList, section);
        break;
    case SocialSection::OutgoingRequests:
        PopulateMenu(*view_.outgoingRequestsList, dataStore_.OutgoingRequests(), [](const domain::SocialFriendRequest& request)
        {
            return SocialPresentationModel::BuildRequestLabel(request, false);
        });
        RestoreSelection(*view_.outgoingRequestsList, section);
        break;
    case SocialSection::Blocked:
        PopulateMenu(*view_.blockedUsersList, dataStore_.BlockedUsers(), [](const domain::SocialUser& user)
        {
            return SocialPresentationModel::BuildUserLabel(user);
        });
        RestoreSelection(*view_.blockedUsersList, section);
        break;
    case SocialSection::Profile:
        break;
    }
}

void SocialSectionPresenter::StoreSelection(SocialSection section)
{
    lila::shared::ui::controls::VerticalMenu* list = nullptr;
    switch (section)
    {
    case SocialSection::Friends: list = view_.friendsList; break;
    case SocialSection::IncomingRequests: list = view_.incomingRequestsList; break;
    case SocialSection::OutgoingRequests: list = view_.outgoingRequestsList; break;
    case SocialSection::Blocked: list = view_.blockedUsersList; break;
    case SocialSection::Profile: return;
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

    const std::array<wxWindow*, 5> panels = {
        view_.friendsPanel,
        view_.incomingRequestsPanel,
        view_.outgoingRequestsPanel,
        view_.blockedPanel,
        view_.profilePanel,
    };
    for (std::size_t index = 0; index < panels.size(); ++index)
    {
        if (panels[index] == targetPanel)
        {
            view_.sectionBook->SetSelection(index);
            view_.sectionBook->Layout();
            owner_.Layout();
            return;
        }
    }
}

void SocialSectionPresenter::ShowCurrentSection()
{
    switch (navigationState_.currentSection)
    {
    case SocialSection::Friends: ShowOnlySectionPanel(view_.friendsPanel); return;
    case SocialSection::IncomingRequests: ShowOnlySectionPanel(view_.incomingRequestsPanel); return;
    case SocialSection::OutgoingRequests: ShowOnlySectionPanel(view_.outgoingRequestsPanel); return;
    case SocialSection::Blocked: ShowOnlySectionPanel(view_.blockedPanel); return;
    case SocialSection::Profile:
        ShowOnlySectionPanel(view_.profilePanel);
        SyncProfileEditorVisibility();
        return;
    }
}
}
