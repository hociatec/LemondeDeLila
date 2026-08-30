#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <optional>
#include <utility>

#include "modules/gameplay/session/application/GameSessionService.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/logging/application/Logger.h"

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
    auto* service = &service_;
    const auto actionType = action.type;
    SubmitInputCommand(
        "game.actions",
        [service, action = std::move(action)](std::stop_token stopToken)
        {
            service->ExecuteAction(action, stopToken);
        },
        "Action de jeu impossible.");
    lila::shared::logging::LogInfo("GameInput", "Action submitted: " + actionType);
}

void GamePlayPanel::SendKey(std::string key)
{
    if (key.empty()) return;
    auto* service = &service_;
    const auto loggedKey = key;
    SubmitInputCommand(
        "game.key",
        [service, key = std::move(key)](std::stop_token stopToken)
        {
            service->SendKey(key, stopToken);
        },
        "Raccourci de jeu impossible.");
    lila::shared::logging::LogInfo("GameInput", "Key submitted: " + loggedKey);
}

void GamePlayPanel::SubmitInputCommand(
    std::string protocolCommand,
    std::function<void(std::stop_token)> command,
    std::string failureMessage)
{
    if (!inputSubmissionGuard_.TryBegin(
            protocolCommand, state_.version, state_.runId))
    {
        lila::shared::logging::LogInfo(
            "GameInput", "Input ignored while a server command is pending.");
        return;
    }
    inputRequestSlot_.Cancel();
    const auto generation = inputRequestSlot_.CurrentToken();
    wxWeakRef<GamePlayPanel> weakThis(this);
    inputRequestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [command = std::move(command)](std::stop_token stopToken)
        {
            command(stopToken);
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
                    if (!weakThis ||
                        !weakThis->inputRequestSlot_.Complete(generation))
                        return;
                    if (!error) return;
                    weakThis->inputSubmissionGuard_.Reset();
                    lila::shared::logging::LogError(
                        "GameInput", "Action task failed: " + error->UserMessage());
                    weakThis->pawnSelectionPanel_->AllowRetry();
                    if (!weakThis->submittedPromptActionType_.empty())
                    {
                        weakThis->submittedPromptActionType_.clear();
                        weakThis->SyncInlinePrompt();
                    }
                    weakThis->startConfigurationFlow_.Reset();
                    weakThis->UpdateStatus(
                        FromUtf8(error->UserMessage()), true, true);
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        std::move(failureMessage)));
}

void GamePlayPanel::RequestRefresh()
{
    auto* service = &service_;
    RunCommand(
        [service](std::stop_token stopToken)
        {
            service->RequestState(stopToken);
        },
        "Actualisation du jeu impossible.");
}

void GamePlayPanel::ShowRules()
{
    activeInfoPanel_ = "rules";
    UpdateInfoPanel();
    auto* service = &service_;
    RunCommand([service](std::stop_token stopToken) { service->RequestRules(stopToken); },
        "Chargement des règles impossible.");
}

void GamePlayPanel::RunCommand(
    std::function<void(std::stop_token)> command,
    std::string failureMessage,
    std::function<void(GamePlayPanel&, const lila::shared::errors::AppError&)> onFailure)
{
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    wxWeakRef<GamePlayPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<bool>(
        [command = std::move(command)](std::stop_token stopToken)
        {
            command(stopToken);
            return true;
        },
        [weakThis, generation, onFailure = std::move(onFailure)](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<bool>) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error),
                 onFailure = std::move(onFailure)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                    if (!error) return;
                    if (onFailure)
                        onFailure(*weakThis, *error);
                    else
                        weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true, true);
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        std::move(failureMessage)));
}
}
