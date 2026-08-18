#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/NetworkPolicy.h"
#include "shared/network/UrlUtils.h"
#include "shared/data/JsonReaders.h"
#include "shared/text/Encoding.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/errors/ErrorMessages.h"
#ifdef _WIN32
#include "shared/network/winhttp/WinHttpHandle.h"
#endif


#include <array>
#include <cctype>
#include <sstream>
#include <stdexcept>
#include <string>
#include <utility>

#include <nlohmann/json.hpp>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#endif

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

struct ParsedUrl final
{
    std::wstring host;
    std::wstring path;
    INTERNET_PORT port = 0;
    bool secure = false;
};

ParsedUrl ParseUrl(const std::string& url)
{
    URL_COMPONENTS components{};
    std::array<wchar_t, 256> hostBuffer{};
    std::array<wchar_t, 2048> pathBuffer{};
    const std::wstring wideUrl = lila::shared::text::Utf8ToWide(url);

    components.dwStructSize = sizeof(components);
    components.lpszHostName = hostBuffer.data();
    components.dwHostNameLength = static_cast<DWORD>(hostBuffer.size());
    components.lpszUrlPath = pathBuffer.data();
    components.dwUrlPathLength = static_cast<DWORD>(pathBuffer.size());

    if (!WinHttpCrackUrl(wideUrl.c_str(), 0, 0, &components))
    {
        throw std::runtime_error(lila::shared::errors::InvalidHttpEndpoint);
    }

    ParsedUrl parsed;
    parsed.host.assign(components.lpszHostName, components.dwHostNameLength);
    parsed.path.assign(components.lpszUrlPath, components.dwUrlPathLength);
    parsed.port = components.nPort;
    parsed.secure = components.nScheme == INTERNET_SCHEME_HTTPS;
    return parsed;
}

std::string ReadResponseBody(HINTERNET request)
{
    std::string body;
    std::array<char, 4096> buffer{};

    while (true)
    {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available))
        {
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        }

        if (available == 0)
        {
            break;
        }

        DWORD read = 0;
        if (!WinHttpReadData(request, buffer.data(), std::min<DWORD>(available, static_cast<DWORD>(buffer.size())), &read))
        {
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        }

        body.append(buffer.data(), buffer.data() + read);
    }

    return body;
}

std::string ReadTicketErrorMessage(const std::string& responseBody)
{
    if (responseBody.empty())
    {
        return {};
    }

    try
    {
        const auto response = lila::shared::data::json::ParseDocument(responseBody, lila::shared::errors::WsTicketResponseInvalid);
        if (!response.is_object())
        {
            return {};
        }

        const auto messageIterator = response.find(std::string(lila::shared::contracts::realtime::MessageField));
        if (messageIterator != response.end() && messageIterator->is_string())
        {
            return messageIterator->get<std::string>();
        }

        const auto errorIterator = response.find(std::string(lila::shared::contracts::realtime::ErrorField));
        if (errorIterator != response.end() && errorIterator->is_string())
        {
            return errorIterator->get<std::string>();
        }
    }
    catch (...)
    {
    }

    return {};
}

std::string BuildTicketRequestError(
    const unsigned long statusCode,
    const std::string& responseBody)
{
    std::ostringstream message;
    message << lila::shared::errors::WsTicketRejectedByApiPrefix << statusCode << ").";

    const auto responseMessage = ReadTicketErrorMessage(responseBody);
    if (!responseMessage.empty())
    {
        message << ' ' << responseMessage << '.';
    }

    if (statusCode == 401 || statusCode == 403)
    {
        message << lila::shared::errors::WsTicketAuthInvalidOrExpired;
    }

    return message.str();
}

std::string RequestTicketFromUrl(const std::string& url, const std::string& bearerToken)
{
    const ParsedUrl parsed = ParseUrl(url);
    const auto userAgent = lila::shared::text::Utf8ToWide(std::string(lila::shared::network::UserAgent));

    lila::shared::network::winhttp::Handle session(WinHttpOpen(
        userAgent.c_str(),
        WINHTTP_ACCESS_TYPE_NO_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0));
    if (!session)
    {
        throw std::runtime_error(lila::shared::errors::HttpSessionCreationFailed);
    }

    if (!WinHttpSetTimeouts(
            session.Get(),
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::SendMs,
            lila::shared::network::NetworkTimeouts::ReceiveMs))
    {
        throw std::runtime_error(lila::shared::errors::HttpTimeoutConfigurationFailed);
    }

    lila::shared::network::winhttp::Handle connection(
        WinHttpConnect(session.Get(), parsed.host.c_str(), parsed.port, 0));
    if (!connection)
    {
        throw std::runtime_error(lila::shared::errors::HttpConnectFailed);
    }

    lila::shared::network::winhttp::Handle request(WinHttpOpenRequest(
        connection.Get(),
        L"GET",
        parsed.path.c_str(),
        nullptr,
        WINHTTP_NO_REFERER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        parsed.secure ? WINHTTP_FLAG_SECURE : 0));
    if (!request)
    {
        throw std::runtime_error(lila::shared::errors::HttpRequestCreationFailed);
    }

    const std::wstring authorization =
        lila::shared::text::Utf8ToWide(std::string(lila::shared::contracts::ws::AuthorizationHeader))
        + L": "
        + lila::shared::text::Utf8ToWide(std::string(lila::shared::contracts::ws::AuthorizationScheme))
        + lila::shared::text::Utf8ToWide(bearerToken)
        + L"\r\n";
    if (!WinHttpAddRequestHeaders(
            request.Get(), authorization.c_str(), static_cast<DWORD>(authorization.size()), WINHTTP_ADDREQ_FLAG_ADD))
    {
        throw std::runtime_error(lila::shared::errors::HttpAuthorizationHeaderFailed);
    }

    if (!WinHttpSendRequest(request.Get(), WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
    {
        throw std::runtime_error(lila::shared::errors::HttpSendRequestFailed);
    }
    if (!WinHttpReceiveResponse(request.Get(), nullptr))
    {
        throw std::runtime_error(lila::shared::errors::HttpResponseReceivedFailed);
    }

    DWORD statusCode = 0;
    DWORD statusCodeSize = sizeof(statusCode);
    if (!WinHttpQueryHeaders(
            request.Get(),
            WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX,
            &statusCode,
            &statusCodeSize,
            WINHTTP_NO_HEADER_INDEX))
    {
        throw std::runtime_error(lila::shared::errors::HttpStatusReadFailed);
    }

    if (statusCode < 200 || statusCode >= 300)
    {
        const auto responseBody = ReadResponseBody(request.Get());
        throw lila::shared::network::http::WsTicketRequestError(
            BuildTicketRequestError(statusCode, responseBody),
            statusCode);
    }

    return ReadResponseBody(request.Get());
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
        origin + std::string(lila::shared::contracts::ws::WsTicketPath) + scope,
        origin + std::string(lila::shared::contracts::ws::WsTicketApiPath) + scope,
    }};

    std::string lastErrorMessage = lila::shared::errors::WsTicketUnavailable;
    for (const std::string& url : candidates)
    {
        try
        {
            const auto responseBody = RequestTicketFromUrl(url, bearerToken);
            const auto document = lila::shared::data::json::ParseDocument(responseBody, lila::shared::errors::WsTicketResponseInvalid);
            const auto iterator = document.find(std::string(lila::shared::contracts::ws::WsTicketResponseField));
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
                break;
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






