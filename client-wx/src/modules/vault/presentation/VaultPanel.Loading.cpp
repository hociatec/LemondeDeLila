#include "modules/vault/presentation/VaultPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/vault/application/VaultService.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/Encoding.h"

namespace lila::modules::vault::presentation
{
void VaultPanel::Prepare(PreparedHandler onPrepared)
{
    if (state_ == State::Mutating)
    {
        if (onPrepared) onPrepared();
        return;
    }
    if (resetSelectionOnNextPrepare_)
    {
        navigator_.Select(0);
        resetSelectionOnNextPrepare_ = false;
    }
    Load(std::move(onPrepared));
}

void VaultPanel::Load(PreparedHandler onPrepared)
{
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Loading;
    auto* service = &service_;
    wxWeakRef<VaultPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<std::vector<domain::VaultSnapshot>>(
        [service](std::stop_token stopToken) { return service->List(stopToken); },
        [weakThis, generation, onPrepared = std::move(onPrepared)](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<std::vector<domain::VaultSnapshot>> snapshots) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), snapshots = std::move(snapshots),
                 onPrepared = std::move(onPrepared)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error || !snapshots)
                    {
                        const auto message = error ? error->UserMessage()
                            : std::string(lila::shared::errors::VaultOperationFailed);
                        weakThis->ShowInitialError(
                            lila::shared::text::FromUtf8(message), std::move(onPrepared));
                        return;
                    }
                    weakThis->ApplySnapshots(std::move(*snapshots), std::move(onPrepared));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::VaultOperationFailed));
}
}
