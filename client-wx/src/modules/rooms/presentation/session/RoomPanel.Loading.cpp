#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <optional>
#include <stdexcept>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/rooms/application/RoomSessionService.h"
#include "modules/audio/application/IAudioService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::StartRequest()
{
    CancelRequest();
    roomService_.Close();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Connecting;
    auto* service = &roomService_;
    const auto request = request_;
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<domain::RoomState>(
        [service, request](std::stop_token stopToken)
        {
            switch (request.kind)
            {
            case RoomOpenRequest::Kind::Create:
                return service->Create(request.gameType, stopToken);
            case RoomOpenRequest::Kind::Join:
                return service->Join(request.roomId, request.spectator, stopToken);
            case RoomOpenRequest::Kind::Restore:
                return service->Restore(request.roomId, stopToken);
            }
            throw std::runtime_error("Type d'ouverture de table invalide.");
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<domain::RoomState> room) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), room = std::move(room)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error || !room)
                    {
                        const auto message = error ? error->UserMessage()
                            : std::string(lila::shared::errors::RoomConnectionFailed);
                        weakThis->ShowError(lila::shared::text::FromUtf8(message), {});
                        return;
                    }
                    weakThis->ApplyRoom(std::move(*room));
                    const auto openedCue = weakThis->request_.kind == RoomOpenRequest::Kind::Create
                        ? lila::modules::audio::domain::SoundCue::RoomOpened
                        : lila::modules::audio::domain::SoundCue::RoomJoined;
                    weakThis->audioService_.Play(openedCue);
                    weakThis->roomService_.Start();
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::RoomConnectionFailed));
}
}
