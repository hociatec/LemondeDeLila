#include "modules/leaderboard/infrastructure/LeaderboardApi.h"

#include <string>

#include <nlohmann/json.hpp>

#include "modules/leaderboard/infrastructure/LeaderboardPayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "shared/errors/domain/AppError.h"
#include "modules/leaderboard/domain/LeaderboardErrorMessages.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::leaderboard::infrastructure
{
LeaderboardApi::LeaderboardApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : client_(client), sessionStore_(sessionStore)
{
}

std::vector<domain::LeaderboardGame> LeaderboardApi::LoadGames(std::stop_token stopToken) const
{
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveLeaderboardSession,
        "leaderboard.games", nlohmann::json::object(), lila::shared::errors::LeaderboardLoadFailed,
        stopToken);
    return codec::ReadGamesPayload(response.payload);
}

domain::LeaderboardTop LeaderboardApi::LoadTop(
    std::string_view gameType,
    std::stop_token stopToken) const
{
    const std::string requestedGameType(gameType);
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveLeaderboardSession,
        "leaderboard.top", nlohmann::json{{"gameType", requestedGameType}},
        lila::shared::errors::LeaderboardLoadFailed, stopToken);
    auto result = codec::ReadTopPayload(response.payload);
    if (result.gameType != requestedGameType)
    {
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                lila::shared::errors::LeaderboardPayloadInvalid,
                "Leaderboard response game type does not match the request."));
    }
    return result;
}
}
