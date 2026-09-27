#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <memory>
#include <wx/weakref.h>

#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::ConfigureStart()
{
    CancelRequest();
    state_ = State::Busy;
    auto result = std::make_shared<std::vector<domain::TableAmbience>>();
    auto* service = &roomLobbyService_;
    const auto generation = requestSlot_.CurrentToken();
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, result](std::stop_token token) { *result = service->ListTableAmbiences(token); },
        [weakThis, generation, result](std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakThis) return;
            weakThis->CallAfter([weakThis, generation, result, error = std::move(error)]() mutable
            {
                if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                weakThis->state_ = State::Ready;
                if (error)
                {
                    weakThis->UpdateStatus(lila::shared::text::FromUtf8(error->UserMessage()), true, true);
                    return;
                }
                std::vector<std::pair<std::string, std::string>> ambiences;
                ambiences.reserve(result->size());
                for (const auto& ambience : *result)
                    ambiences.emplace_back(ambience.soundId, ambience.name);
                weakThis->gamePlayPanel_->SetStartAmbiences(std::move(ambiences));
                if (weakThis->gamePlayPanel_->BeginRoomStart()) return;
                weakThis->ExecuteCommand({domain::RoomCommand::Start, false, {}});
            });
        }));
}
}
