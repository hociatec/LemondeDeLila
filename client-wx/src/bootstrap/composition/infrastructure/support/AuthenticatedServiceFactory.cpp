#include "bootstrap/composition/infrastructure/support/AuthenticatedServiceFactory.h"

#include "shared/network/infrastructure/websocket/WinHttpWebSocketClient.h"

namespace lila::bootstrap::detail
{
std::unique_ptr<shared::network::websocket::IWebSocketClient> CreateWebSocketClient()
{
    return std::make_unique<shared::network::websocket::WinHttpWebSocketClient>();
}
}
