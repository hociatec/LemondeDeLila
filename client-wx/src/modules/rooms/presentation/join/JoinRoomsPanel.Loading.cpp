#include "modules/rooms/presentation/join/JoinRoomsPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>
#include <wx/stattext.h>

#include "modules/rooms/application/RoomLobbyService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void JoinRoomsPanel::Prepare(PreparedHandler onPrepared)
{
    Load(std::move(onPrepared));
}

void JoinRoomsPanel::Load(PreparedHandler onPrepared)
{
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Loading;
    statusLabel_->Hide();

    auto* service = &service_;
    wxWeakRef<JoinRoomsPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<std::vector<domain::PublicRoom>>(
        [service](std::stop_token stopToken) { return service->ListPublic(stopToken); },
        [weakThis, generation, onPrepared = std::move(onPrepared)](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<std::vector<domain::PublicRoom>> rooms) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), rooms = std::move(rooms),
                 onPrepared = std::move(onPrepared)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error || !rooms)
                    {
                        const auto message = error ? error->UserMessage()
                            : std::string(lila::shared::errors::RoomLobbyLoadFailed);
                        weakThis->ShowError(lila::shared::text::FromUtf8(message), std::move(onPrepared));
                        return;
                    }
                    weakThis->ApplyRooms(std::move(*rooms), std::move(onPrepared));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::RoomLobbyLoadFailed));
}
}
