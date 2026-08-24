#include "modules/rooms/presentation/RoomPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/presentation/RoomPresentationModel.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::HandleAction(std::string_view itemId)
{
    using Action = RoomPresentationModel::Action;
    using Command = domain::RoomCommand;
    switch (RoomPresentationModel::ActionForId(itemId))
    {
    case Action::Start: ExecuteCommand({Command::Start}); return;
    case Action::AddBot: ExecuteCommand({Command::AddBot}); return;
    case Action::RemoveBot: ExecuteCommand({Command::RemoveBot}); return;
    case Action::ShowInfo: ExecuteCommand({Command::Info}); return;
    case Action::TogglePrivacy: ExecuteCommand({Command::TogglePrivacy}); return;
    case Action::ToggleRole: ExecuteCommand({Command::SetRole, !room_.selfSpectator}); return;
    case Action::Reset: ExecuteCommand({Command::Reset}); return;
    case Action::ShowPlayers:
        UpdateStatus(RoomPresentationModel::BuildPlayers(room_), false, true);
        return;
    case Action::Save: Save(); return;
    case Action::Leave: RequestLeaveConfirmation(); return;
    case Action::None: return;
    }
}

void RoomPanel::ExecuteCommand(domain::RoomCommandRequest request)
{
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Busy;
    auto* service = &roomService_;
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, request](std::stop_token stopToken) { service->Execute(request, stopToken); },
        [weakThis, generation](std::optional<lila::shared::errors::AppError> error) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    weakThis->state_ = State::Ready;
                    if (error)
                    {
                        weakThis->UpdateStatus(
                            lila::shared::text::FromUtf8(error->UserMessage()), true, true);
                        return;
                    }
                    weakThis->ShowRoom();
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::RoomConnectionFailed));
}
}
