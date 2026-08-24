#pragma once

#include <nlohmann/json.hpp>
#include <stop_token>
#include <stdexcept>
#include <string>

#include "modules/session/application/SessionStore.h"
#include "shared/errors/AppError.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/network/realtime/RealtimeApiClient.h"

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

    return client.Send(
        {
            .type = type,
            .payload = std::move(payload),
        },
        sessionStore.Current().token,
        stopToken);
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
                lila::shared::errors::ErrorCode::InvalidSession,
                lila::shared::errors::SessionExpiredMessage));
    }

    if (response.errorKind == RealtimeErrorKind::Server && !response.errorMessage.empty())
    {
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                lila::shared::errors::ErrorCode::Unexpected,
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

