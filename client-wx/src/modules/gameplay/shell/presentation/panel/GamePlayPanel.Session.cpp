#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "shared/concurrency/application/BackgroundExecutor.h"

namespace lila::modules::gameplay::presentation
{
void GamePlayPanel::AttachEventHandler()
{
    service_.SetEventHandler(
        [weakThis = wxWeakRef<GamePlayPanel>(this)](domain::GameEvent event) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, event = std::move(event)]() mutable
                {
                    if (weakThis) weakThis->HandleEvent(std::move(event));
                });
        });
}

void GamePlayPanel::StartJoin()
{
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    auto* service = &service_;
    const int roomId = roomId_;
    const std::string gameType = gameType_;
    wxWeakRef<GamePlayPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<domain::GameState>(
        [service, roomId, gameType](std::stop_token stopToken)
        {
            return service->Join(roomId, gameType, stopToken);
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<domain::GameState> state) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), state = std::move(state)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error || !state)
                    {
                        const auto message = error ? error->UserMessage() : std::string("Connexion au jeu impossible.");
                        weakThis->UpdateStatus(FromUtf8(message), true, true);
                        return;
                    }
                    weakThis->ApplyState(std::move(*state));
                    weakThis->service_.Start();
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        "Connexion au jeu impossible."));
}

void GamePlayPanel::ExecuteAction(domain::GameAction action)
{
    if (action.type.empty() || action.disabled) return;
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    auto* service = &service_;
    wxWeakRef<GamePlayPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [service, action = std::move(action)](std::stop_token stopToken)
        {
            service->ExecuteAction(action, stopToken);
            return true;
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error)
                    {
                        weakThis->pawnSelectionPanel_->AllowRetry();
                        if (!weakThis->submittedPromptActionType_.empty())
                        {
                            weakThis->submittedPromptActionType_.clear();
                            weakThis->SyncInlinePrompt();
                        }
                        weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true, true);
                        return;
                    }
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        "Action de jeu impossible."));
}

void GamePlayPanel::RequestRefresh()
{
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    auto* service = &service_;
    wxWeakRef<GamePlayPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [service](std::stop_token stopToken)
        {
            service->RequestState(stopToken);
            return true;
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error) weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true, true);
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        "Actualisation du jeu impossible."));
}

void GamePlayPanel::RequestTurn()
{
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    auto* service = &service_;
    wxWeakRef<GamePlayPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [service](std::stop_token stopToken)
        {
            service->RequestTurn(stopToken);
            return true;
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error) weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true, true);
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        "Tour de jeu indisponible."));
}

void GamePlayPanel::SendKey(std::string key)
{
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    auto* service = &service_;
    wxWeakRef<GamePlayPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [service, key = std::move(key)](std::stop_token stopToken)
        {
            service->SendKey(key, stopToken);
            return true;
        },
        [weakThis, generation](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (error) weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true, true);
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        "Raccourci de jeu indisponible."));
}
}
