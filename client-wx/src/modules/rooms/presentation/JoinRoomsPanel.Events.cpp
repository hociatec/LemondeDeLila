#include "modules/rooms/presentation/JoinRoomsPanel.h"

#include "shared/accessibility/application/NavigationController.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::rooms::presentation
{
void JoinRoomsPanel::BindEvents()
{
    menu_->SetSelectionChangedHandler(
        [this](std::size_t index)
        {
            if (state_ == State::Ready) navigator_.Select(index);
        });
    menu_->SetActivatedHandler(
        [this](std::size_t index)
        {
            if (state_ == State::Loading) return;
            if (state_ == State::Error)
            {
                Load();
                return;
            }
            navigator_.Select(index);
            const auto* room = navigator_.SelectedRoom();
            if (room != nullptr && onJoinRequested_)
                onJoinRequested_(room->id, room->spectatorOnly);
        });
    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        *this,
        [this]()
        {
            CancelRequest();
            if (onCloseRequested_) onCloseRequested_();
            return true;
        });
}
}
