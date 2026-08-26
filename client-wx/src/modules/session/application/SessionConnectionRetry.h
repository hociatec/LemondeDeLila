#pragma once

#include <stop_token>
#include <utility>

#include "modules/session/application/SessionStore.h"
#include "shared/network/application/http/IWsTicketProvider.h"

namespace lila::modules::session::application
{
template <typename Disconnect, typename Connect>
void ConnectWithSessionRefresh(
    SessionStore& sessionStore,
    std::stop_token stopToken,
    Disconnect&& disconnect,
    Connect&& connect)
{
    try
    {
        std::forward<Connect>(connect)(sessionStore.AccessToken(stopToken));
    }
    catch (const lila::shared::network::http::WsTicketRequestError& exception)
    {
        if (exception.StatusCode() != 401 && exception.StatusCode() != 403) throw;
        std::forward<Disconnect>(disconnect)();
        std::forward<Connect>(connect)(sessionStore.RefreshAccessToken(stopToken));
    }
}
}
