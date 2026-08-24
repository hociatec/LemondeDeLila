#include "shared/network/infrastructure/http/WsTicketProvider.h"
#include "shared/network/infrastructure/http/WsTicketTransport.h"
#include "shared/network/domain/NetworkPolicy.h"
#include "shared/network/domain/UrlUtils.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/errors/catalog/ErrorMessages.h"


#include <array>
#include <cctype>
#include <stdexcept>
#include <string>
#include <utility>

#include <nlohmann/json.hpp>

namespace
{
#ifdef _WIN32
bool IsSafeTicketScope(const std::string& scope)
{
    if (scope.empty())
    {
        return false;
    }

    for (const unsigned char character : scope)
    {
        if (!std::isalnum(character) && character != '-' && character != '_' && character != '.')
        {
            return false;
        }
    }

    return true;
}
#endif
}

namespace lila::shared::network::http
{
WsTicketProvider::WsTicketProvider(std::string backendApiWsEndpoint)
    : backendApiWsEndpoint_(std::move(backendApiWsEndpoint))
{
}

std::string WsTicketProvider::GetTicket(const std::string& scope, const std::string& bearerToken) const
{
#ifdef _WIN32
    if (!IsSafeTicketScope(scope))
    {
        throw std::invalid_argument(lila::shared::errors::WsTicketScopeInvalid);
    }

    if (bearerToken.empty())
    {
        throw std::invalid_argument(lila::shared::errors::WsTicketAuthTokenRequired);
    }

    const std::string origin = lila::shared::network::WebSocketOriginToHttp(backendApiWsEndpoint_);
    const std::array<std::string, 2> candidates = {{
        origin + std::string(lila::shared::network::ws::WsTicketPath) + scope,
        origin + std::string(lila::shared::network::ws::WsTicketApiPath) + scope,
    }};

    std::string lastErrorMessage = lila::shared::errors::WsTicketUnavailable;
    for (const std::string& url : candidates)
    {
        try
        {
            const auto responseBody = RequestWsTicketResponse(url, bearerToken);
            const auto document = lila::shared::data::json::ParseDocument(responseBody, lila::shared::errors::WsTicketResponseInvalid);
            const auto iterator = document.find(std::string(lila::shared::network::ws::WsTicketResponseField));
            if (iterator != document.end() && iterator->is_string())
            {
                const std::string ticket = iterator->get<std::string>();
                if (!ticket.empty())
                {
                    return ticket;
                }
            }

            lastErrorMessage = lila::shared::errors::WsTicketMissing;
        }
        catch (const lila::shared::network::http::WsTicketRequestError& exception)
        {
            lastErrorMessage = exception.what();
            if (exception.StatusCode() == 401 || exception.StatusCode() == 403)
            {
                throw;
            }
        }
        catch (const std::exception& exception)
        {
            lastErrorMessage = exception.what();
        }
    }

    throw std::runtime_error(lastErrorMessage);
#else
    (void)scope;
    (void)bearerToken;
    throw std::runtime_error(lila::shared::errors::WsTicketUnsupportedTransport);
#endif
}
}

lila::shared::network::http::WsTicketRequestError::WsTicketRequestError(
    std::string message,
    unsigned long statusCode)
    : std::runtime_error(std::move(message)),
      statusCode_(statusCode)
{
}

unsigned long lila::shared::network::http::WsTicketRequestError::StatusCode() const
{
    return statusCode_;
}
