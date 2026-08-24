#include "modules/vault/presentation/VaultPanel.h"

#include <algorithm>
#include <utility>

#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::vault::presentation
{
VaultPanel::VaultPanel(
    wxWindow* parent,
    application::VaultService& service,
    RestoreRequestedHandler onRestoreRequested,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(parent, 0),
      service_(service),
      onRestoreRequested_(std::move(onRestoreRequested)),
      onCloseRequested_(std::move(onCloseRequested))
{
    BuildLayout();
    BindEvents();
}

VaultPanel::~VaultPanel()
{
    CancelRequest();
}

void VaultPanel::ResetSelectionForNextPrepare()
{
    resetSelectionOnNextPrepare_ = true;
}

lila::shared::accessibility::FocusManager::Plan VaultPanel::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (menu_ == nullptr || menu_->GetItemCount() == 0) return plan;
    const auto selected = state_ == State::ConfirmDelete
        ? std::size_t{0}
        : std::min(navigator_.SelectedIndex(), menu_->GetItemCount() - 1);
    menu_->SetSelectedIndexSilently(selected);
    plan.AddWindow(menu_->GetSelectedControl());
    return plan;
}

void VaultPanel::CancelRequest()
{
    requestSlot_.Cancel();
}
}
