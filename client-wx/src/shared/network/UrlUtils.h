#pragma once

#include <stdexcept>
#include <string>
#include <string_view>

#include "shared/contracts/BackendWsContracts.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::shared::network
{
inline std::string ExtractOrigin(const std::string& endpoint)
{
    const std::size_t schemeSeparator = endpoint.find("://");
    if (schemeSeparator == std::string::npos)
    {
        return endpoint;
    }

    const std::size_t pathStart = endpoint.find('/', schemeSeparator + 3);
    return pathStart == std::string::npos ? endpoint : endpoint.substr(0, pathStart);
}

inline std::string WebSocketOriginToHttp(const std::string& endpoint)
{
    const std::string origin = ExtractOrigin(endpoint);
    const std::string wssScheme(lila::shared::contracts::ws::WssScheme);
    const std::string wsScheme(lila::shared::contracts::ws::WsScheme);

    if (origin.rfind(wssScheme, 0) == 0)
    {
        return std::string(lila::shared::contracts::ws::HttpsScheme) + origin.substr(wssScheme.size());
    }

    if (origin.rfind(wsScheme, 0) == 0)
    {
        return std::string(lila::shared::contracts::ws::HttpScheme) + origin.substr(wsScheme.size());
    }

    throw std::runtime_error(lila::shared::errors::WsTicketSchemaUnsupported);
}
}
