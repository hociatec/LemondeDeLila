#pragma once

#include "modules/leaderboard/application/ILeaderboardGateway.h"

namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }

namespace lila::modules::leaderboard::infrastructure
{
class LeaderboardApi final : public application::ILeaderboardGateway
{
public:
    LeaderboardApi(
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
        lila::modules::session::application::SessionStore& sessionStore) noexcept;

    [[nodiscard]] std::vector<domain::LeaderboardGame> LoadGames(std::stop_token stopToken) const override;
    [[nodiscard]] domain::LeaderboardTop LoadTop(
        std::string_view gameType,
        std::stop_token stopToken) const override;

private:
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
