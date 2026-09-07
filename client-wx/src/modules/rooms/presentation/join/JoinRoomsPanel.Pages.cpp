#include "modules/rooms/presentation/join/JoinRoomsPanel.h"

#include <algorithm>
#include <array>

#include <wx/stattext.h>
#include <wx/weakref.h>

#include "modules/rooms/presentation/lobby/RoomLobbyPresentationModel.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"
#include "shared/ui/presentation/layout/ListPagePresentation.h"

namespace lila::modules::rooms::presentation
{
void JoinRoomsPanel::ApplyRooms(std::vector<domain::PublicRoom> rooms, PreparedHandler onPrepared)
{
    navigator_.Reset(std::move(rooms));
    state_ = State::Ready;
    ShowRooms();
    if (onPrepared) onPrepared();
}

void JoinRoomsPanel::ShowLoading()
{
    using Item = lila::shared::ui::controls::VerticalMenuItem;
    const std::array<Item, 1> items = {{
        {"loading", wxString(L"Chargement des parties en cours")},
    }};
    state_ = State::Loading;
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(0);
    lila::shared::ui::layout::UpdateListPageStatus(*this, *statusLabel_, wxString{}, false);
    FocusMenuIfVisible();
}

void JoinRoomsPanel::ShowRooms()
{
    const auto items = RoomLobbyPresentationModel::BuildItems(navigator_, state_ == State::Error);
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(std::min(navigator_.SelectedIndex(), items.size() - 1));
    lila::shared::ui::layout::UpdateListPageStatus(*this, *statusLabel_, wxString{}, false);
    FocusMenuIfVisible();
}

void JoinRoomsPanel::ShowError(const wxString& message, PreparedHandler onPrepared)
{
    state_ = State::Error;
    ShowRooms();
    lila::shared::ui::layout::UpdateListPageStatus(*this, *statusLabel_, message, true);
    if (onPrepared) onPrepared();
}

void JoinRoomsPanel::FocusMenuIfVisible()
{
    if (!IsShownOnScreen()) return;

    wxWeakRef<JoinRoomsPanel> weakThis(this);
    lila::shared::accessibility::FocusCoordinator::ScheduleAction(
        *this,
        [weakThis]()
        {
            if (!weakThis || !weakThis->IsShownOnScreen())
                return;

            const auto plan = weakThis->BuildFocusPlan();
            if (!lila::shared::accessibility::FocusCoordinator::Apply(plan))
                return;

            auto* focusedItem = weakThis->menu_->GetSelectedControl();
            if (focusedItem != nullptr && focusedItem->HasFocus())
                lila::shared::accessibility::AccessibilityUtils::NotifyFocus(*focusedItem);
        });
}
}
