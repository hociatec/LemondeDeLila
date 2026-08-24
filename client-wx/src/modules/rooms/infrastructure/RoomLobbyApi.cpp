#include "modules/rooms/infrastructure/RoomLobbyApi.h"
#include <nlohmann/json.hpp>
#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiHelpers.h"

namespace lila::modules::rooms::infrastructure
{
RoomLobbyApi::RoomLobbyApi(
    lila::shared::network::realtime::AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore) noexcept
    : client_(client), sessionStore_(sessionStore) {}
std::vector<domain::PublicRoom> RoomLobbyApi::ListPublic(std::stop_token stopToken) const
{
    const auto response = lila::shared::network::realtime::helpers::SendAuthenticatedRequest(
        client_, sessionStore_, lila::shared::errors::NoActiveRoomSession,
        "room.lobby.list", nlohmann::json::object(), lila::shared::errors::RoomLobbyLoadFailed, stopToken);
    return codec::ReadPublicRooms(response.payload);
}
}
