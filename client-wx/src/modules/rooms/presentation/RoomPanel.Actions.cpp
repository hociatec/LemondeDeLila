#include "modules/rooms/presentation/RoomPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/rooms/application/RoomSessionService.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/text/Encoding.h"

namespace lila::modules::rooms::presentation
{
namespace
{
std::string DescribeRoomForSave(const domain::RoomState& room)
{
    std::string actions;
    for (std::size_t i = 0; i < room.allowedActions.size(); ++i)
    {
        if (i > 0) actions += ",";
        actions += room.allowedActions[i];
    }

    return "roomId=" + std::to_string(room.id) +
        " status=" + room.status +
        " started=" + std::string(room.started ? "true" : "false") +
        " allowedActions=[" + actions + "]";
}
}

void RoomPanel::Save()
{
    if (room_.id <= 0 || !onSaveRequested_) return;
    lila::shared::logging::LogInfo("RoomSave", "Attempt save: " + DescribeRoomForSave(room_));
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Busy;
    saveInProgress_ = true;
    const auto roomId = room_.id;
    const auto saveRequested = onSaveRequested_;
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<std::string>(
        [saveRequested, roomId](std::stop_token stopToken) { return saveRequested(roomId, stopToken); },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<std::string> savedId) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), savedId = std::move(savedId)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    weakThis->state_ = State::Ready;
                    weakThis->saveInProgress_ = false;
                    if (error || !savedId)
                    {
                        const auto message = error ? error->UserMessage()
                            : std::string(lila::shared::errors::VaultOperationFailed);
                        lila::shared::logging::LogWarning(
                            "RoomSave",
                            "Save rejected: " + DescribeRoomForSave(weakThis->room_) +
                                " message=" + message);
                        weakThis->UpdateStatus(lila::shared::text::FromUtf8(message), true, true);
                        return;
                    }
                    lila::shared::logging::LogInfo(
                        "RoomSave",
                        "Save succeeded: " + DescribeRoomForSave(weakThis->room_) +
                            " snapshotId=" + *savedId);
                    weakThis->UpdateStatus(
                        wxString(L"Table sauvegard\u00E9e dans Mon coffre fort."),
                        false,
                        true);
                    weakThis->CallAfter(
                        [weakThis]()
                        {
                            if (weakThis) weakThis->CloseSession();
                        });
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::VaultOperationFailed));
}

void RoomPanel::Leave()
{
    if (request_.kind == RoomOpenRequest::Kind::Restore &&
        room_.id > 0 && onAbandonRequested_)
    {
        CancelRequest();
        const auto generation = requestSlot_.CurrentToken();
        state_ = State::Busy;
        abandonInProgress_ = true;
        const auto roomId = room_.id;
        const auto abandonRequested = onAbandonRequested_;
        wxWeakRef<RoomPanel> weakThis(this);
        requestSlot_.Track(lila::shared::concurrency::RunAsync(
            [abandonRequested, roomId](std::stop_token stopToken)
            {
                abandonRequested(roomId, stopToken);
            },
            [weakThis, generation](std::optional<lila::shared::errors::AppError> error) mutable
            {
                if (!weakThis) return;
                weakThis->CallAfter(
                    [weakThis, generation, error = std::move(error)]() mutable
                    {
                        if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                        weakThis->abandonInProgress_ = false;
                        if (error)
                        {
                            weakThis->state_ = State::Ready;
                            weakThis->ShowRoom();
                            weakThis->UpdateStatus(
                                lila::shared::text::FromUtf8(error->UserMessage()), true, true);
                            return;
                        }
                        weakThis->CloseSession();
                    });
            },
            lila::shared::concurrency::BackgroundTaskPriority::Normal,
            lila::shared::errors::VaultOperationFailed));
        return;
    }

    CancelRequest();
    roomService_.Leave();
    room_ = {};
    if (onCloseRequested_) onCloseRequested_();
}

void RoomPanel::CloseSession()
{
    CancelRequest();
    roomService_.Close();
    room_ = {};
    saveInProgress_ = false;
    abandonInProgress_ = false;
    if (onCloseRequested_) onCloseRequested_();
}
}
