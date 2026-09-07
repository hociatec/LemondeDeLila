#pragma once

#include <nlohmann/json.hpp>
#include <stop_token>
#include <stdexcept>
#include <string>

#include "modules/session/application/SessionStore.h"
#include "shared/errors/domain/AppError.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/errors/presentation/ErrorFormatting.h"
#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::shared::network::realtime
{
namespace helpers
{
inline RealtimeApiResponse SendAndCheckAuth(
    const AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore,
    const std::string& noActiveSessionMessage,
    const std::string& type,
    nlohmann::json payload,
    std::stop_token stopToken = {})
{
    if (!sessionStore.HasActiveSession())
    {
        throw std::runtime_error(noActiveSessionMessage);
    }

    const RealtimeApiRequest request(type, std::move(payload));
    auto response = client.Send(request, sessionStore.AccessToken(stopToken), stopToken);
    if ((response.statusCode == 401 || response.statusCode == 403)
        && !stopToken.stop_requested())
    {
        response = client.Send(
            request,
            sessionStore.RefreshAccessToken(stopToken),
            stopToken);
    }
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
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                lila::shared::errors::SessionExpiredMessage));
    }

    if (response.errorKind == RealtimeErrorKind::Server && !response.errorMessage.empty())
    {
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                response.errorMessage));
    }

    throw std::runtime_error(
        lila::shared::errors::WithDetails(fallbackMessage.c_str(), response.errorMessage));
}

inline RealtimeApiResponse SendAuthenticatedRequest(
    const AuthenticatedRealtimeApiClient& client,
    lila::modules::session::application::SessionStore& sessionStore,
    const std::string& noActiveSessionMessage,
    const std::string& type,
    nlohmann::json payload,
    const std::string& fallbackMessage,
    std::stop_token stopToken = {})
{
    auto response = SendAndCheckAuth(
        client, sessionStore, noActiveSessionMessage, type, std::move(payload), stopToken);
    EnsureSuccessOrThrow(response, sessionStore, fallbackMessage);
    return response;
}
}
}
