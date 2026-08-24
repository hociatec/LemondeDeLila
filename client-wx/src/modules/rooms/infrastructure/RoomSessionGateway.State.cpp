#include "modules/rooms/infrastructure/RoomSessionGateway.h"

#include <stdexcept>

#include <nlohmann/json.hpp>

#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/rooms/infrastructure/RoomProtocol.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::modules::rooms::infrastructure
{
domain::RoomState RoomSessionGateway::AwaitState(std::stop_token stopToken)
{
    for (int attempt = 0; attempt < 32 && !stopToken.stop_requested(); ++attempt)
    {
        auto event = DecodeEvent(nlohmann::json::parse(client_.Receive()));
        if (event.type == domain::RoomEventType::Error)
        {
            throw std::runtime_error(event.message.empty() ? "Connexion table impossible." : event.message);
        }
        if (event.type == domain::RoomEventType::Closed)
            throw std::runtime_error("La table n'est plus disponible.");
        if (event.type == domain::RoomEventType::StateUpdated && event.room)
            return std::move(*event.room);
        if (event.type != domain::RoomEventType::Ignored)
        {
            std::scoped_lock lock(pendingEventsMutex_);
            pendingEvents_.push_back(std::move(event));
        }
    }
    throw std::runtime_error("Connexion table interrompue.");
}
}
