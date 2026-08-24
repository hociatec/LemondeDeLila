#include "modules/catalog/presentation/CatalogPanel.h"

#include <utility>

#include "modules/catalog/application/CatalogService.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::catalog::presentation
{
CatalogPanel::CatalogPanel(
    wxWindow* parent,
    application::CatalogService& catalogService,
    OpenJoinRoomsRequestedHandler onOpenJoinRoomsRequested,
    OpenStoryBookRequestedHandler onOpenStoryBookRequested,
    OpenVaultRequestedHandler onOpenVaultRequested,
    OpenGameRequestedHandler onOpenGameRequested,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      catalogService_(catalogService),
      onOpenJoinRoomsRequested_(std::move(onOpenJoinRoomsRequested)),
      onOpenStoryBookRequested_(std::move(onOpenStoryBookRequested)),
      onOpenVaultRequested_(std::move(onOpenVaultRequested)),
      onOpenGameRequested_(std::move(onOpenGameRequested)),
      onCloseRequested_(std::move(onCloseRequested))
{
    BuildLayout();
    BindEvents();
    LoadShelves();
}

CatalogPanel::~CatalogPanel()
{
    if (activeTask_ != nullptr)
    {
        activeTask_->RequestCancel();
    }
}

void CatalogPanel::ResetToRootForNextShow()
{
    CancelCatalogLoad();
    rootSelectedIndex_ = 0;
    shelfNavigator_.ResetToRoot();
    if (state_ == State::Ready)
    {
        ShowCurrentShelves();
    }
}

lila::shared::accessibility::FocusManager::Plan CatalogPanel::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (shelvesMenu_ == nullptr || shelvesMenu_->GetItemCount() == 0)
    {
        return plan;
    }

    std::size_t selectedIndex = rootSelectedIndex_;
    if (state_ == State::Ready && !shelfNavigator_.IsAtRoot())
    {
        selectedIndex = shelfNavigator_.SelectedIndex();
    }
    shelvesMenu_->SetSelectedIndexSilently(selectedIndex);
    plan.AddWindow(shelvesMenu_->GetSelectedControl());
    return plan;
}
}
