#include "modules/leaderboard/presentation/LeaderboardPanel.h"

#include <optional>
#include <stop_token>
#include <utility>

#include <wx/weakref.h>

#include "modules/leaderboard/application/LeaderboardService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "modules/leaderboard/domain/LeaderboardErrorMessages.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::leaderboard::presentation
{
void LeaderboardPanel::LoadGames(PreparedHandler onPrepared)
{
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Loading;
    pendingRequest_ = Request::Games;
    UpdateStatus(wxString{});

    auto* service = &service_;
    wxWeakRef<LeaderboardPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<std::vector<domain::LeaderboardGame>>(
        [service](std::stop_token stopToken) { return service->LoadGames(stopToken); },
        [weakThis, generation, onPrepared = std::move(onPrepared)](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<std::vector<domain::LeaderboardGame>> games) mutable
        {
            if (!weakThis)
            {
                return;
            }
            weakThis->CallAfter(
                [weakThis, generation, error = std::move(error), games = std::move(games),
                 onPrepared = std::move(onPrepared)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation))
                    {
                        return;
                    }
                    if (error.has_value() || !games.has_value())
                    {
                        const auto message = error.has_value()
                            ? error->UserMessage()
                            : std::string(lila::shared::errors::LeaderboardLoadFailed);
                        weakThis->ShowError(lila::shared::text::FromUtf8(message), Request::Games);
                        if (onPrepared)
                        {
                            onPrepared();
                        }
                        return;
                    }
                    weakThis->ApplyGames(std::move(*games), std::move(onPrepared));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::LeaderboardLoadFailed));
}

void LeaderboardPanel::LoadTop(std::size_t gameIndex)
{
    if (gameIndex >= navigator_.Games().size())
    {
        return;
    }
    navigator_.Select(gameIndex);
    const auto gameType = navigator_.Games()[gameIndex].gameType;
    CancelRequest();
    const auto generation = requestSlot_.CurrentToken();
    state_ = State::Loading;
    pendingRequest_ = Request::Top;
    pendingGameIndex_ = gameIndex;
    UpdateStatus(wxString{});

    auto* service = &service_;
    wxWeakRef<LeaderboardPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<domain::LeaderboardTop>(
        [service, gameType](std::stop_token stopToken) { return service->LoadTop(gameType, stopToken); },
        [weakThis, generation, gameIndex](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<domain::LeaderboardTop> top) mutable
        {
            if (!weakThis)
            {
                return;
            }
            weakThis->CallAfter(
                [weakThis, generation, gameIndex, error = std::move(error), top = std::move(top)]() mutable
                {
                    if (!weakThis || !weakThis->requestSlot_.Complete(generation))
                    {
                        return;
                    }
                    if (error.has_value() || !top.has_value())
                    {
                        const auto message = error.has_value()
                            ? error->UserMessage()
                            : std::string(lila::shared::errors::LeaderboardLoadFailed);
                        weakThis->ShowError(
                            lila::shared::text::FromUtf8(message), Request::Top, gameIndex);
                        return;
                    }
                    weakThis->ApplyTop(gameIndex, std::move(*top));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::Normal,
        lila::shared::errors::LeaderboardLoadFailed));
}

void LeaderboardPanel::ApplyGames(
    std::vector<domain::LeaderboardGame> games,
    PreparedHandler onPrepared)
{
    navigator_.ResetGames(std::move(games));
    gamesLoaded_ = true;
    state_ = State::Ready;
    ShowCurrentPage();
    if (onPrepared)
    {
        onPrepared();
    }
}

void LeaderboardPanel::ApplyTop(std::size_t gameIndex, domain::LeaderboardTop top)
{
    navigator_.OpenTop(gameIndex, std::move(top));
    state_ = State::Ready;
    ShowCurrentPage();
}
}
