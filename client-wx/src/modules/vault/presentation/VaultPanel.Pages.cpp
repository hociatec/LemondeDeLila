#include "modules/vault/presentation/VaultPanel.h"

#include <algorithm>

#include <wx/stattext.h>

#include "modules/vault/presentation/VaultPresentationModel.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/layout/ListPagePresentation.h"

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
    lila::shared::ui::layout::UpdateListPageStatus(*this, *statusLabel_, wxString{}, false);
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
    lila::shared::ui::layout::UpdateListPageStatus(*this, *statusLabel_, message, true);
}

void VaultPanel::FocusMenuIfVisible()
{
    lila::shared::ui::layout::FocusListPageIfVisible(*this, BuildFocusPlan());
}
}
