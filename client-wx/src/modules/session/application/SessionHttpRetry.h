#pragma once

#include <stop_token>
#include <utility>

#include "modules/session/application/SessionStore.h"

namespace lila::modules::session::application
{
template <typename Send>
auto SendHttpWithSessionRefresh(
    SessionStore& sessionStore,
    std::stop_token stopToken,
    bool retryAllowed,
    Send&& send)
{
    auto response = std::forward<Send>(send)(sessionStore.AccessToken(stopToken));
    if (retryAllowed && (response.statusCode == 401 || response.statusCode == 403) &&
        !stopToken.stop_requested())
    {
        response = std::forward<Send>(send)(sessionStore.RefreshAccessToken(stopToken));
    }
    return response;
}
}
