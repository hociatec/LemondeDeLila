#include "modules/gameplay/presentation/GamePlayPanel.h"

#include <optional>
#include <utility>

#include "modules/gameplay/application/GameSessionService.h"
#include "modules/gameplay/presentation/GamePlayFormatters.h"
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
    UpdateStatus(wxString(L"Connexion au jeu..."), false, true);
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
                    weakThis->UpdateStatus(wxString(L"Jeu connecté."), false, true);
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
    UpdateStatus(wxString(L"Action envoyée..."), false, true);
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
                        weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true, true);
                        return;
                    }
                    weakThis->UpdateStatus(wxString(L"En attente du nouvel état..."));
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
}
