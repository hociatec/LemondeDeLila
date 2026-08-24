#pragma once
#include "modules/rooms/application/IRoomLobbyGateway.h"
namespace lila::modules::session::application { class SessionStore; }
namespace lila::shared::network::realtime { class AuthenticatedRealtimeApiClient; }
namespace lila::modules::rooms::infrastructure
{
class RoomLobbyApi final : public application::IRoomLobbyGateway
{
public:
    RoomLobbyApi(lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
                 lila::modules::session::application::SessionStore& sessionStore) noexcept;
    [[nodiscard]] std::vector<domain::PublicRoom> ListPublic(std::stop_token stopToken) const override;
private:
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client_;
    lila::modules::session::application::SessionStore& sessionStore_;
};
}
