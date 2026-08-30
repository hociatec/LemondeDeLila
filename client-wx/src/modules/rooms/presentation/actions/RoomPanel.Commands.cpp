#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "modules/audio/application/IAudioService.h"
#include "modules/rooms/presentation/model/RoomPresentationModel.h"
#include "modules/rooms/presentation/zone/RoomGameZoneAnchor.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "modules/rooms/domain/RoomErrorMessages.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::HandleAction(std::string_view itemId)
{
    using Action = RoomPresentationModel::Action;
    using Command = domain::RoomCommand;
    switch (RoomPresentationModel::ActionForId(itemId))
    {
    case Action::ShowGameStatus:
    {
        const auto message = RoomPresentationModel::BuildStatus(room_);
        UpdateStatus(message, false, true);
        AppendRoomAnnouncement(message);
        return;
    }
    case Action::Start:
        if (gamePlayPanel_->BeginRoomStart()) return;
        ExecuteCommand({Command::Start, false, {}});
        return;
    case Action::AddBot: ExecuteCommand({Command::AddBot, false, {}}); return;
    case Action::RemoveBot: ExecuteCommand({Command::RemoveBot, false, {}}); return;
    case Action::ShowInfo: ExecuteCommand({Command::Info, false, {}}); return;
    case Action::ShowRules: ShowRules(); return;
    case Action::ConfigureAmbience: ConfigureAmbience(); return;
    case Action::ConfigureAmbienceVolume: ConfigureAmbienceVolume(); return;
    case Action::Invite: InvitePlayer(); return;
    case Action::Kick: ModeratePlayer(false); return;
    case Action::Ban: ModeratePlayer(true); return;
    case Action::SetOwner: TransferOwnership(); return;
    case Action::TogglePrivacy: ExecuteCommand({Command::TogglePrivacy, false, {}}); return;
    case Action::ToggleRole:
        ExecuteCommand({Command::SetRole, !room_.selfSpectator, {}});
        return;
    case Action::Reset: RequestResetConfirmation(); return;
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
    const auto command = request.command;
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, request](std::stop_token stopToken) { service->Execute(request, stopToken); },
        [weakThis, generation, command](std::optional<lila::shared::errors::AppError> error) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, command, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    weakThis->state_ = State::Ready;
                    if (error)
                    {
                        if (command == domain::RoomCommand::Start)
                            weakThis->gamePlayPanel_->NotifyRoomStartFailed(
                                lila::shared::text::FromUtf8(error->UserMessage()));
                        weakThis->UpdateStatus(
                            lila::shared::text::FromUtf8(error->UserMessage()), true, true);
                        return;
                    }
                    if (command == domain::RoomCommand::SendChat)
                    {
                        weakThis->audioService_.Play(
                            lila::modules::audio::domain::SoundCue::TableChatMessageSent);
                    }
                    if (command == domain::RoomCommand::Reset)
                    {
                        const wxString message(L"Table r\u00E9initialis\u00E9e.");
                        weakThis->AppendRoomAnnouncement(message);
                    }
                    weakThis->ShowRoom();
                    if (command == domain::RoomCommand::Reset)
                    {
                        static_cast<void>(
                            lila::shared::accessibility::NavigationController::Focus(
                                weakThis->gameZoneAnchor_));
                    }
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::RoomConnectionFailed));
}
}
