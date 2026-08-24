#include "modules/user/infrastructure/WsSessionRefresher.h"

#include <exception>

#include "modules/user/infrastructure/remote/JwtLoginClaimsParser.h"
#include "modules/user/infrastructure/remote/UserAuthRemoteDataSource.h"
#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::modules::user::infrastructure
{
WsSessionRefresher::WsSessionRefresher(remote::UserAuthRemoteDataSource& remoteDataSource)
    : remoteDataSource_(remoteDataSource)
{
}

session::application::SessionRefreshResult WsSessionRefresher::Refresh(
    const std::string& refreshToken,
    std::stop_token stopToken)
{
    session::application::SessionRefreshResult result;
    if (stopToken.stop_requested())
    {
        result.errorMessage = "Renouvellement de session interrompu.";
        return result;
    }

    const auto response = remoteDataSource_.Refresh(refreshToken, stopToken);
    if (!response.success)
    {
        result.rejected = response.errorKind == shared::network::realtime::RealtimeErrorKind::Server
            || response.errorKind == shared::network::realtime::RealtimeErrorKind::Authentication;
        result.errorMessage = response.errorMessage;
        return result;
    }

    try
    {
        const auto payload = remote::UserAuthRemoteDataSource::ParseLoginPayload(response);
        const auto claims = remote::JwtLoginClaimsParser::Parse(payload.token);
        result.success = !payload.token.empty() && !payload.refreshToken.empty();
        result.token = payload.token;
        result.refreshToken = payload.refreshToken;
        result.expiresAt = claims.expiresAt;
        if (!result.success)
        {
            result.rejected = true;
            result.errorMessage = "La reponse de renouvellement est incomplete.";
        }
    }
    catch (const std::exception& exception)
    {
        result.rejected = true;
        result.errorMessage = exception.what();
    }
    return result;
}

bool WsSessionRefresher::Revoke(
    const std::string& refreshToken,
    std::stop_token stopToken)
{
    if (refreshToken.empty() || stopToken.stop_requested())
    {
        return refreshToken.empty();
    }

    return remoteDataSource_.Logout(refreshToken, stopToken).success;
}
}
