#pragma once

#include <nlohmann/json.hpp>
#include <stdexcept>
#include <string>

#include "shared/errors/ErrorMessages.h"
#include "shared/network/realtime/RealtimeApiClient.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "modules/session/application/SessionStore.h"

namespace lila::shared::network::realtime
{
namespace helpers
{
inline RealtimeApiResponse SendAndCheckAuth(
    const AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore,
    const std::string& noActiveSessionMessage,
    const std::string& type,
    nlohmann::json payload)
{
    if (!sessionStore.HasActiveSession())
    {
        throw std::runtime_error(noActiveSessionMessage);
    }

    const auto response = client.Send(
        {
            .type = type,
            .payload = std::move(payload),
        },
        sessionStore.Current().token);

    return response;
}

inline void EnsureSuccessOrThrow(
    const RealtimeApiResponse& response,
    lila::modules::session::application::SessionStore& sessionStore,
    const std::string& fallbackMessage)
{
    if (response.success)
    {
        return;
    }

    if (response.statusCode == 401 || response.statusCode == 403)
    {
        sessionStore.Clear();
        throw std::runtime_error(lila::shared::errors::SessionExpiredMessage);
    }

    throw std::runtime_error(response.errorMessage.empty() ? fallbackMessage : response.errorMessage);
}
}
}
