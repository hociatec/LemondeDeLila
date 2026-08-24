#pragma once

#include <cstddef>
#include <functional>
#include <memory>
#include <vector>

#include "modules/rooms/domain/Room.h"
#include "modules/rooms/presentation/RoomLobbyNavigator.h"
#include "shared/accessibility/FocusPlanView.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/concurrency/AsyncRequestSlot.h"

class wxStaticText;
class wxWindow;
namespace lila::shared::ui::controls { class VerticalMenu; }
namespace lila::modules::rooms::application { class RoomLobbyService; }

namespace lila::modules::rooms::presentation
{
class JoinRoomsPanel final : public lila::shared::accessibility::NonFocusablePanel,
                             public lila::shared::accessibility::FocusPlanView
{
public:
    using PreparedHandler = std::function<void()>;
    using JoinRequestedHandler = std::function<void(int roomId, bool spectator)>;
    using CloseRequestedHandler = std::function<void()>;

    JoinRoomsPanel(
        wxWindow* parent,
        application::RoomLobbyService& service,
        JoinRequestedHandler onJoinRequested,
        CloseRequestedHandler onCloseRequested);
    ~JoinRoomsPanel() override;

    void Prepare(PreparedHandler onPrepared);
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    enum class State { Loading, Ready, Error };

    void BuildLayout();
    void BindEvents();
    void Load(PreparedHandler onPrepared = {});
    void ApplyRooms(std::vector<domain::PublicRoom> rooms, PreparedHandler onPrepared);
    void ShowRooms();
    void ShowError(const wxString& message, PreparedHandler onPrepared);
    void CancelRequest();
    void FocusMenuIfVisible();

    application::RoomLobbyService& service_;
    JoinRequestedHandler onJoinRequested_;
    CloseRequestedHandler onCloseRequested_;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    RoomLobbyNavigator navigator_;
    lila::shared::concurrency::AsyncRequestSlot requestSlot_;
    State state_ = State::Loading;
};
}
