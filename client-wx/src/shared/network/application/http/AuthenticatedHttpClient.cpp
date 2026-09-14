#include "shared/network/application/http/AuthenticatedHttpClient.h"

#include <array>
#include <algorithm>
#include <cctype>
#include <iomanip>
#include <limits>
#include <sstream>
#include <stdexcept>

#include "shared/errors/catalog/NetworkErrorMessages.h"
#include "shared/network/domain/NetworkPolicy.h"
#include "shared/network/domain/WebSocketConstants.h"

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#include "shared/network/infrastructure/winhttp/WinHttpHandle.h"
#include "shared/text/presentation/encoding/Encoding.h"
#endif

namespace lila::shared::network::http
{
namespace
{
#ifdef _WIN32
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
    std::array<wchar_t, 256> host{};
    std::array<wchar_t, 4096> path{};
    std::array<wchar_t, 4096> extra{};
    const auto wide = lila::shared::text::Utf8ToWide(url);
    components.dwStructSize = sizeof(components);
    components.lpszHostName = host.data();
    components.dwHostNameLength = static_cast<DWORD>(host.size());
    components.lpszUrlPath = path.data();
    components.dwUrlPathLength = static_cast<DWORD>(path.size());
    components.lpszExtraInfo = extra.data();
    components.dwExtraInfoLength = static_cast<DWORD>(extra.size());
    if (!WinHttpCrackUrl(wide.c_str(), 0, 0, &components))
        throw std::runtime_error(lila::shared::errors::InvalidHttpEndpoint);
    ParsedUrl result;
    result.host.assign(components.lpszHostName, components.dwHostNameLength);
    result.path.assign(components.lpszUrlPath, components.dwUrlPathLength);
    if (components.dwExtraInfoLength > 0)
        result.path.append(components.lpszExtraInfo, components.dwExtraInfoLength);
    result.port = components.nPort;
    result.secure = components.nScheme == INTERNET_SCHEME_HTTPS;
    return result;
}

void AddHeader(HINTERNET request, const std::string& name, const std::string& value)
{
    const auto header = lila::shared::text::Utf8ToWide(name + ": " + value + "\r\n");
    if (!WinHttpAddRequestHeaders(
            request, header.c_str(), static_cast<DWORD>(header.size()),
            WINHTTP_ADDREQ_FLAG_ADD | WINHTTP_ADDREQ_FLAG_REPLACE))
        throw std::runtime_error(lila::shared::errors::HttpAuthorizationHeaderFailed);
}

std::string ReadBody(HINTERNET request)
{
    constexpr std::size_t MaximumResponseBytes = 32U * 1024U * 1024U;
    std::string body;
    std::array<char, 8192> buffer{};
    while (true)
    {
        DWORD available = 0;
        if (!WinHttpQueryDataAvailable(request, &available))
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        if (available == 0) break;
        if (body.size() + available > MaximumResponseBytes)
            throw std::runtime_error("Réponse HTTP administrateur trop volumineuse.");
        DWORD read = 0;
        if (!WinHttpReadData(
                request, buffer.data(),
                std::min<DWORD>(available, static_cast<DWORD>(buffer.size())), &read))
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        body.append(buffer.data(), read);
    }
    return body;
}
#endif
}

HttpResponse AuthenticatedHttpClient::Send(
    const HttpRequest& request,
    const std::string& bearerToken,
    std::stop_token stopToken) const
{
    if (stopToken.stop_requested()) throw std::runtime_error("Opération HTTP annulée.");
#ifdef _WIN32
    const auto parsed = ParseUrl(request.url);
    const auto method = lila::shared::text::Utf8ToWide(request.method);
    lila::shared::network::winhttp::Handle session(WinHttpOpen(
        L"LeMondeDeLilaWX/1.0", WINHTTP_ACCESS_TYPE_NO_PROXY,
        WINHTTP_NO_PROXY_NAME, WINHTTP_NO_PROXY_BYPASS, 0));
    if (!session) throw std::runtime_error(lila::shared::errors::HttpSessionCreationFailed);
    if (!WinHttpSetTimeouts(
            session.Get(), NetworkTimeouts::ResolveAndConnectMs,
            NetworkTimeouts::ResolveAndConnectMs, NetworkTimeouts::SendMs,
            NetworkTimeouts::ReceiveMs))
        throw std::runtime_error(lila::shared::errors::HttpTimeoutConfigurationFailed);

    lila::shared::network::winhttp::Handle connection(
        WinHttpConnect(session.Get(), parsed.host.c_str(), parsed.port, 0));
    if (!connection) throw std::runtime_error(lila::shared::errors::HttpConnectFailed);
    lila::shared::network::winhttp::Handle nativeRequest(WinHttpOpenRequest(
        connection.Get(), method.c_str(), parsed.path.c_str(), nullptr,
        WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES,
        parsed.secure ? WINHTTP_FLAG_SECURE : 0));
    if (!nativeRequest) throw std::runtime_error(lila::shared::errors::HttpRequestCreationFailed);
    std::stop_callback cancelRequest(stopToken, [&nativeRequest]() { nativeRequest.Reset(); });

    AddHeader(nativeRequest.Get(), "Authorization", "Bearer " + bearerToken);
    AddHeader(nativeRequest.Get(), "Accept", "application/json");
    if (!request.contentType.empty()) AddHeader(nativeRequest.Get(), "Content-Type", request.contentType);
    for (const auto& [name, value] : request.headers) AddHeader(nativeRequest.Get(), name, value);
    if (request.body.size() > static_cast<std::size_t>(std::numeric_limits<DWORD>::max()))
        throw std::runtime_error("Corps HTTP trop volumineux.");
    const auto size = static_cast<DWORD>(request.body.size());
    auto* data = request.body.empty()
        ? WINHTTP_NO_REQUEST_DATA
        : const_cast<char*>(request.body.data());
    if (!WinHttpSendRequest(
            nativeRequest.Get(), WINHTTP_NO_ADDITIONAL_HEADERS, 0,
            data, size, size, 0))
    {
        if (stopToken.stop_requested()) throw std::runtime_error("Opération HTTP annulée.");
        throw std::runtime_error(lila::shared::errors::HttpSendRequestFailed);
    }
    if (stopToken.stop_requested()) throw std::runtime_error("Opération HTTP annulée.");
    if (!WinHttpReceiveResponse(nativeRequest.Get(), nullptr))
    {
        if (stopToken.stop_requested()) throw std::runtime_error("Opération HTTP annulée.");
        throw std::runtime_error(lila::shared::errors::HttpResponseReceivedFailed);
    }
    DWORD statusCode = 0;
    DWORD statusSize = sizeof(statusCode);
    if (!WinHttpQueryHeaders(
            nativeRequest.Get(), WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
            WINHTTP_HEADER_NAME_BY_INDEX, &statusCode, &statusSize,
            WINHTTP_NO_HEADER_INDEX))
        throw std::runtime_error(lila::shared::errors::HttpStatusReadFailed);
    return {statusCode, ReadBody(nativeRequest.Get())};
#else
    (void)request;
    (void)bearerToken;
    throw std::runtime_error(lila::shared::errors::WsTicketUnsupportedTransport);
#endif
}

std::string UrlEncode(std::string_view value)
{
    std::ostringstream output;
    output << std::uppercase << std::hex;
    for (const unsigned char character : value)
    {
        if (std::isalnum(character) || character == '-' || character == '_' ||
            character == '.' || character == '~')
            output << character;
        else
            output << '%' << std::setw(2) << std::setfill('0')
                   << static_cast<unsigned int>(character);
    }
    return output.str();
}
}
