#include "modules/vault/presentation/VaultPanel.h"

#include <algorithm>

#include <wx/stattext.h>

#include "modules/vault/presentation/VaultPresentationModel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/FocusCoordinator.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::vault::presentation
{
void VaultPanel::ApplySnapshots(
    std::vector<domain::VaultSnapshot> snapshots,
    PreparedHandler onPrepared)
{
    navigator_.Reset(std::move(snapshots));
    state_ = State::Ready;
    ShowCurrentPage();
    if (onPrepared) onPrepared();
}

void VaultPanel::ShowCurrentPage()
{
    const auto items = VaultPresentationModel::BuildItems(
        navigator_, state_ == State::InitialError);
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(std::min(navigator_.SelectedIndex(), items.size() - 1));
    statusLabel_->Hide();
    Layout();
    FocusMenuIfVisible();
}

void VaultPanel::ShowInitialError(const wxString& message, PreparedHandler onPrepared)
{
    state_ = State::InitialError;
    ShowCurrentPage();
    ShowOperationError(message);
    if (onPrepared) onPrepared();
}

void VaultPanel::ShowOperationError(const wxString& message)
{
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(lila::shared::ui::Theme::Error());
    statusLabel_->Show();
    lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*statusLabel_, message);
    Layout();
}

void VaultPanel::FocusMenuIfVisible()
{
    if (IsShownOnScreen())
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
}
}
