#include "modules/rooms/presentation/join/JoinRoomsPanel.h"

#include <algorithm>

#include <wx/stattext.h>

#include "modules/rooms/presentation/lobby/RoomLobbyPresentationModel.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/ui/presentation/theme/Theme.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::rooms::presentation
{
void JoinRoomsPanel::ApplyRooms(std::vector<domain::PublicRoom> rooms, PreparedHandler onPrepared)
{
    navigator_.Reset(std::move(rooms));
    state_ = State::Ready;
    ShowRooms();
    if (onPrepared) onPrepared();
}

void JoinRoomsPanel::ShowRooms()
{
    const auto items = RoomLobbyPresentationModel::BuildItems(navigator_, state_ == State::Error);
    menu_->SetItems(items);
    menu_->SetSelectedIndexSilently(std::min(navigator_.SelectedIndex(), items.size() - 1));
    statusLabel_->Hide();
    Layout();
    FocusMenuIfVisible();
}

void JoinRoomsPanel::ShowError(const wxString& message, PreparedHandler onPrepared)
{
    state_ = State::Error;
    ShowRooms();
    statusLabel_->SetLabel(message);
    statusLabel_->SetForegroundColour(lila::shared::ui::Theme::Error());
    statusLabel_->Show();
    Layout();
    if (onPrepared) onPrepared();
}

void JoinRoomsPanel::FocusMenuIfVisible()
{
    if (IsShownOnScreen())
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(BuildFocusPlan()));
}
}
