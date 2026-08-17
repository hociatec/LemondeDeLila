#include "modules/chat/presentation/ChatFrame.h"

#include <algorithm>
#include <array>
#include <stdexcept>
#include <optional>
#include <sstream>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/network/NetworkPolicy.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"
#include "shared/config/AppConfig.h"
#include "shared/network/websocket/WinHttpWebSocketClient.h"
#include "shared/text/Encoding.h"
#include "shared/text/StringUtils.h"
#include "shared/ui/BackgroundTask.h"
#include "shared/ui/Theme.h"

#include <wx/button.h>
#include <wx/dialog.h>
#include <wx/msgdlg.h>
#include <wx/sizer.h>
#include <wx/textctrl.h>

#ifdef _WIN32
#include <windows.h>
#include <winhttp.h>
#endif

namespace
{
constexpr int WindowWidth = 1100;
constexpr int WindowHeight = 760;

struct ConnectionCheck final
{
    std::string name;
    bool success = false;
    std::string details;
};

struct ParsedUrl final
{
    std::wstring host;
    std::wstring path;
    INTERNET_PORT port = 0;
    bool secure = false;
};

std::string BuildConnectionReport(const std::vector<ConnectionCheck>& checks)
{
    std::ostringstream report;
    report << "Tests de connexion :";
    for (const auto& check : checks)
    {
        report << "\n" << (check.success ? "[OK] " : "[ERREUR] ") << check.name;
        if (!check.details.empty())
        {
            report << " - " << check.details;
        }
    }

    return report.str();
}

ParsedUrl ParseUrl(const std::string& endpoint)
{
#ifdef _WIN32
    URL_COMPONENTS components{};
    std::array<wchar_t, 256> hostBuffer{};
    std::array<wchar_t, 2048> pathBuffer{};
    std::array<wchar_t, 1024> queryBuffer{};

    components.dwStructSize = sizeof(components);
    components.lpszHostName = hostBuffer.data();
    components.dwHostNameLength = static_cast<DWORD>(hostBuffer.size());
    components.lpszUrlPath = pathBuffer.data();
    components.dwUrlPathLength = static_cast<DWORD>(pathBuffer.size());
    components.lpszExtraInfo = queryBuffer.data();
    components.dwExtraInfoLength = static_cast<DWORD>(queryBuffer.size());

    const auto wideEndpoint = lila::shared::text::Utf8ToWide(endpoint);
    if (!WinHttpCrackUrl(wideEndpoint.c_str(), 0, 0, &components))
    {
        throw std::runtime_error(lila::shared::errors::InvalidHttpEndpoint);
    }

    ParsedUrl parsed;
    parsed.host.assign(components.lpszHostName, components.dwHostNameLength);
    parsed.path.assign(components.lpszUrlPath, components.dwUrlPathLength);
    if (components.dwExtraInfoLength > 0)
    {
        parsed.path += std::wstring(components.lpszExtraInfo, components.dwExtraInfoLength);
    }

    if (parsed.path.empty())
    {
        parsed.path = L"/";
    }
    parsed.port = components.nPort;
    parsed.secure = components.nScheme == INTERNET_SCHEME_HTTPS;
    return parsed;
#else
    (void)endpoint;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}

std::string ReadResponseBody(HINTERNET request)
{
#ifdef _WIN32
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
        const DWORD chunkSize = std::min<DWORD>(available, static_cast<DWORD>(buffer.size()));
        if (!WinHttpReadData(request, buffer.data(), chunkSize, &read))
        {
            throw std::runtime_error(lila::shared::errors::HttpResponseReadFailed);
        }

        body.append(buffer.data(), read);
    }

    return body;
#else
    (void)request;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}

std::string HttpGet(
    const std::string& endpoint,
    const std::optional<std::string>& bearerToken,
    const std::vector<std::pair<std::string, std::string>>& extraHeaders = {})
{
#ifdef _WIN32
    const ParsedUrl parsed = ParseUrl(endpoint);
    const auto userAgent = lila::shared::text::Utf8ToWide(std::string(lila::shared::network::UserAgent));
    HINTERNET session = WinHttpOpen(
        userAgent.c_str(),
        WINHTTP_ACCESS_TYPE_NO_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0);
    if (session == nullptr)
    {
        throw std::runtime_error(lila::shared::errors::HttpSessionCreationFailed);
    }

    if (!WinHttpSetTimeouts(
            session,
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::ResolveAndConnectMs,
            lila::shared::network::NetworkTimeouts::SendMs,
            lila::shared::network::NetworkTimeouts::ReceiveMs))
    {
        WinHttpCloseHandle(session);
        throw std::runtime_error(lila::shared::errors::HttpTimeoutConfigurationFailed);
    }

    HINTERNET connection = nullptr;
    HINTERNET request = nullptr;

    try
    {
        connection = WinHttpConnect(session, parsed.host.c_str(), parsed.port, 0);
        if (connection == nullptr)
        {
            throw std::runtime_error(lila::shared::errors::HttpConnectFailed);
        }

        request = WinHttpOpenRequest(
            connection,
            L"GET",
            parsed.path.c_str(),
            nullptr,
            WINHTTP_NO_REFERER,
            WINHTTP_DEFAULT_ACCEPT_TYPES,
            parsed.secure ? WINHTTP_FLAG_SECURE : 0);
        if (request == nullptr)
        {
            throw std::runtime_error(lila::shared::errors::HttpRequestCreationFailed);
        }

        std::vector<std::pair<std::string, std::string>> headers;
        if (bearerToken.has_value() && !bearerToken->empty())
        {
            headers.emplace_back(
                std::string(lila::shared::contracts::ws::AuthorizationHeader),
                std::string(lila::shared::contracts::ws::AuthorizationScheme) + bearerToken.value());
        }
        for (const auto& header : extraHeaders)
        {
            headers.push_back(header);
        }

        for (const auto& [name, value] : headers)
        {
            if (name.empty() || value.empty())
            {
                continue;
            }

            const auto headerLine = name + ": " + value + "\r\n";
            const auto headerWide = lila::shared::text::Utf8ToWide(headerLine);
            if (!WinHttpAddRequestHeaders(
                    request,
                    headerWide.c_str(),
                    static_cast<DWORD>(headerWide.size()),
                    WINHTTP_ADDREQ_FLAG_ADD))
            {
                throw std::runtime_error(lila::shared::errors::HttpAuthorizationHeaderFailed);
            }
        }

        if (!WinHttpSendRequest(request, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0))
        {
            throw std::runtime_error(lila::shared::errors::HttpSendRequestFailed);
        }

        if (!WinHttpReceiveResponse(request, nullptr))
        {
            throw std::runtime_error(lila::shared::errors::HttpResponseReceivedFailed);
        }

        DWORD statusCode = 0;
        DWORD statusCodeSize = sizeof(statusCode);
        if (!WinHttpQueryHeaders(
                request,
                WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                WINHTTP_HEADER_NAME_BY_INDEX,
                &statusCode,
                &statusCodeSize,
                WINHTTP_NO_HEADER_INDEX))
        {
            throw std::runtime_error(lila::shared::errors::HttpStatusReadFailed);
        }

        const std::string body = ReadResponseBody(request);
        if (statusCode < 200 || statusCode >= 300)
        {
            const std::string trimmed = lila::shared::text::TrimCopy(body);
            const std::string snippet =
                trimmed.empty()
                    ? "sans detail"
                    : trimmed.substr(0, std::min<std::size_t>(260, trimmed.size()));
            throw std::runtime_error("HTTP " + std::to_string(statusCode) + " - " + snippet);
        }

        WinHttpCloseHandle(request);
        WinHttpCloseHandle(connection);
        WinHttpCloseHandle(session);
        return body;
    }
    catch (...)
    {
        if (request != nullptr)
        {
            WinHttpCloseHandle(request);
        }
        if (connection != nullptr)
        {
            WinHttpCloseHandle(connection);
        }
        WinHttpCloseHandle(session);
        throw;
    }
#else
    (void)endpoint;
    (void)bearerToken;
    (void)extraHeaders;
    throw std::runtime_error(lila::shared::errors::WinHttpUnsupportedTransport);
#endif
}

std::string ToHttpOriginFromWs(const std::string& wsEndpoint)
{
    const auto schemeSeparator = wsEndpoint.find("://");
    if (schemeSeparator == std::string::npos)
    {
        return {};
    }

    const std::string scheme = wsEndpoint.substr(0, schemeSeparator);
    const std::string rest = wsEndpoint.substr(schemeSeparator + 3);
    const std::size_t pathStart = rest.find('/');
    const std::string hostAndPort = pathStart == std::string::npos ? rest : rest.substr(0, pathStart);
    if (scheme == std::string(lila::shared::contracts::ws::WssScheme))
    {
        return std::string(lila::shared::contracts::ws::HttpsScheme) + hostAndPort;
    }

    if (scheme == std::string(lila::shared::contracts::ws::WsScheme))
    {
        return std::string(lila::shared::contracts::ws::HttpScheme) + hostAndPort;
    }

    return wsEndpoint;
}

std::string ToApiOriginFromWs(const std::string& wsEndpoint)
{
    const std::string wsOrigin = ToHttpOriginFromWs(wsEndpoint);
    const auto schemeSeparator = wsOrigin.find("://");
    if (schemeSeparator == std::string::npos)
    {
        return wsOrigin;
    }

    const std::string scheme = wsOrigin.substr(0, schemeSeparator);
    const std::string host = wsOrigin.substr(schemeSeparator + 3);
    if (host.rfind("api.", 0) == 0)
    {
        return wsOrigin;
    }

    if (host.rfind("ws.", 0) == 0)
    {
        return scheme + "://api." + host.substr(3);
    }

    return wsOrigin;
}

std::string TicketDiagnosticPayload(std::string responseBody)
{
    try
    {
        const auto response = lila::shared::data::json::ParseDocument(responseBody, lila::shared::errors::WsTicketResponseInvalid);
        const auto ticketIterator = response.find(std::string(lila::shared::contracts::ws::WsTicketResponseField));
        if (ticketIterator != response.end() && ticketIterator->is_string())
        {
            const auto ticket = ticketIterator->get<std::string>();
            return "ticket=" + ticket.substr(0, std::min<size_t>(12, ticket.size())) + "...";
        }

        return "ticket manquant";
    }
    catch (...)
    {
        return "reponse JSON invalide";
    }
}

void AddCheck(
    std::vector<ConnectionCheck>& checks,
    const std::string& name,
    bool ok,
    std::string details)
{
    if (details.empty())
    {
        details = ok ? "OK" : "Echec";
    }

    checks.push_back({name, ok, details});
}

void CheckHttpEndpoint(
    const std::string& name,
    const std::string& url,
    const std::string& bearerToken,
    std::vector<ConnectionCheck>& checks)
{
    try
    {
        HttpGet(url, bearerToken.empty() ? std::nullopt : std::optional<std::string>(bearerToken));
        AddCheck(checks, name, true, "200");
    }
    catch (const std::exception& error)
    {
        AddCheck(checks, name, false, error.what());
    }
}

void CheckWsTicket(
    const std::string& name,
    const std::string& url,
    const std::string& bearerToken,
    std::vector<ConnectionCheck>& checks)
{
    try
    {
        const auto response = HttpGet(
            url,
            bearerToken.empty() ? std::nullopt : std::optional<std::string>(bearerToken));
        AddCheck(checks, name, true, TicketDiagnosticPayload(response));
    }
    catch (const std::exception& error)
    {
        AddCheck(checks, name, false, error.what());
    }
}

void CheckWebSocketEndpoint(
    const std::string& name,
    const std::string& wsEndpoint,
    const std::string& scope,
    const std::string& bearerToken,
    const std::string& clientVersion,
    const lila::shared::network::http::WsTicketProvider& ticketProvider,
    std::vector<ConnectionCheck>& checks)
{
    try
    {
        if (bearerToken.empty())
        {
            AddCheck(checks, name, false, "Session absente");
            return;
        }

        const std::string ticket = ticketProvider.GetTicket(scope, bearerToken);
        lila::shared::network::websocket::WebSocketHeaders headers;
        headers.emplace(
            std::string(lila::shared::contracts::ws::AuthorizationHeader),
            std::string(lila::shared::contracts::ws::AuthorizationScheme) + bearerToken);
        headers.emplace(std::string(lila::shared::contracts::ws::ClientVersionHeader), clientVersion);
        headers.emplace(std::string(lila::shared::contracts::ws::WsTicketHeader), ticket);

        lila::shared::network::websocket::WinHttpWebSocketClient ws;
        ws.Connect(wsEndpoint, headers);
        ws.Close();
        AddCheck(checks, name, true, "handshake OK");
    }
    catch (const std::exception& error)
    {
        AddCheck(checks, name, false, error.what());
    }
}

void CheckApiCapabilities(
    const std::string& apiWsEndpoint,
    const std::string& bearerToken,
    const std::string& clientVersion,
    lila::shared::network::http::WsTicketProvider& ticketProvider,
    std::vector<ConnectionCheck>& checks)
{
    try
    {
        if (bearerToken.empty())
        {
            AddCheck(checks, "api.capabilities", false, "Session absente");
            return;
        }

        lila::shared::network::websocket::WinHttpWebSocketClient ws;
        lila::shared::network::realtime::AuthenticatedRealtimeApiClient apiClient(
            apiWsEndpoint,
            clientVersion,
            ws,
            ticketProvider);
        const auto response = apiClient.Send(
            {
                .type = std::string(lila::shared::contracts::api::CapabilitiesEvent),
                .payload = nlohmann::json::object(),
            },
            bearerToken);
        if (!response.success)
        {
            AddCheck(checks, "api.capabilities", false, response.errorMessage.empty() ? "Ã‰chec" : response.errorMessage);
            return;
        }

        AddCheck(checks, "api.capabilities", true, "OK");
    }
    catch (const std::exception& error)
    {
        AddCheck(checks, "api.capabilities", false, error.what());
    }
}
}

namespace lila::modules::chat::presentation
{
ChatFrame::ChatFrame(
    lila::modules::chat::application::ChatService& chatService,
    lila::modules::options::application::OptionsStore& optionsStore,
    lila::modules::session::application::SessionStore& sessionStore,
    lila::shared::network::http::WsTicketProvider& wsTicketProvider,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString::Format(
              wxString::FromUTF8(lila::shared::errors::ChatFrameTitle),
              wxString::FromUTF8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      chatService_(chatService),
      optionsStore_(optionsStore),
      sessionStore_(sessionStore),
      wsTicketProvider_(wsTicketProvider),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    BuildLayout();
    ApplyTheme();
    BindEvents();

    chatService_.SetStatusChangedHandler(
        [this](const std::string& message, bool isError)
        {
            CallAfter(
                [this, message, isError]()
                {
                    UpdateStatus(wxString::FromUTF8(message), isError);
                    SyncActionState();
                });
        });
    chatService_.SetMessagesChangedHandler(
        [this]()
        {
            CallAfter(
                [this]()
                {
                    RefreshHistory();
                });
        });

    CentreOnScreen();
    CallAfter(
        [this]()
        {
            OpenChat();
            RunConnectionDiagnostics();
        });
}

ChatFrame::~ChatFrame()
{
    InvalidateOpenChatRequest();
    chatService_.SetStatusChangedHandler({});
    chatService_.SetMessagesChangedHandler({});
}

void ChatFrame::RunConnectionDiagnostics()
{
    if (diagnosticsOutput_ == nullptr || testConnectionButton_ == nullptr)
    {
        return;
    }

    if (isConnectionTestRunning_)
    {
        return;
    }

    isConnectionTestRunning_ = true;
    testConnectionButton_->Enable(false);
    diagnosticsOutput_->SetValue(wxString::FromUTF8("Lancement des tests de connexion..."));
    diagnosticsOutput_->SetInsertionPointEnd();
    const std::size_t requestId = ++connectionTestRequestId_;
    const bool hasSession = sessionStore_.HasActiveSession();
    const std::string bearerToken = hasSession ? sessionStore_.Current().token : std::string{};
    const std::string clientVersion = shared::config::AppConfig::ResolveClientVersion();
    const std::string wsEndpoint = shared::config::AppConfig::ResolveBackendApiWs();
    const std::string wsPresenceEndpoint =
        shared::config::AppConfig::ResolvePresenceWs() +
        std::string(lila::shared::contracts::ws::PresenceContextQuery) +
        std::string(lila::shared::contracts::ws::PresenceContextChat);
    const std::string wsOrigin = ToHttpOriginFromWs(wsEndpoint);
    const std::string apiOrigin = ToApiOriginFromWs(wsEndpoint);
    const std::string wsTicketFromWsEndpoint = wsOrigin + std::string(lila::shared::contracts::ws::WsTicketPath);
    const std::string wsTicketFromApiEndpoint = apiOrigin + std::string(lila::shared::contracts::ws::WsTicketApiPath);
    const std::string wsGameEndpoint = wsOrigin + "/ws/game";
    const std::string wsNotifyEndpoint = wsOrigin + "/ws/notify";
    const std::string healthEndpoint = apiOrigin + "/health";
    const std::string healthInfoEndpoint = apiOrigin + "/health/info";
    const std::string altHealthEndpoint = apiOrigin + "/api/health";
    const std::string altHealthInfoEndpoint = apiOrigin + "/api/health/info";
    const std::string versionEndpoint =
        apiOrigin + "/client/version?current=" + shared::config::AppConfig::ResolveClientVersion();
    const std::string altVersionEndpoint =
        apiOrigin + "/api/client/version?current=" + shared::config::AppConfig::ResolveClientVersion();
    auto& ticketProvider = wsTicketProvider_;

    wxWeakRef<ChatFrame> weakSelf(this);
    lila::shared::ui::RunBackgroundTaskWithResult<std::vector<ConnectionCheck>>(
        this,
        [bearerToken,
         wsEndpoint,
         wsTicketFromWsEndpoint,
         wsTicketFromApiEndpoint,
         wsPresenceEndpoint,
         wsGameEndpoint,
         wsNotifyEndpoint,
         healthEndpoint,
         healthInfoEndpoint,
         altHealthEndpoint,
         altHealthInfoEndpoint,
         versionEndpoint,
         altVersionEndpoint,
         &ticketProvider,
         clientVersion]()
        {
            std::vector<ConnectionCheck> checks;
            const bool hasToken = !bearerToken.empty();

            auto runHttp = [&](const std::string& name, const std::string& endpoint)
            {
                if (endpoint.empty())
                {
                    AddCheck(checks, name, false, "URL manquante");
                    return;
                }

                CheckHttpEndpoint(name, endpoint, bearerToken, checks);
            };

            auto runTicket = [&](const std::string& name, const std::string& endpointBase, const std::string& scope)
            {
                if (endpointBase.empty())
                {
                    AddCheck(checks, name, false, "URL manquante");
                    return;
                }

                CheckWsTicket(name, endpointBase + scope, bearerToken, checks);
            };

            auto runWs = [&](const std::string& name, const std::string& endpoint, const std::string& scope)
            {
                if (!hasToken)
                {
                    AddCheck(checks, name, false, "Session absente");
                    return;
                }

                CheckWebSocketEndpoint(name, endpoint, scope, bearerToken, clientVersion, ticketProvider, checks);
            };

            AddCheck(checks, "Configuration endpoints", true, "lecture ok");
            runHttp("GET /health", healthEndpoint);
            runHttp("GET /health/info", healthInfoEndpoint);
            runHttp("GET /api/health", altHealthEndpoint);
            runHttp("GET /api/health/info", altHealthInfoEndpoint);
            runHttp("GET /client/version?current=...", versionEndpoint);
            runHttp("GET /api/client/version?current=...", altVersionEndpoint);
            runTicket("GET /ws/ticket?scope=api", wsTicketFromWsEndpoint, "api");
            runTicket("GET /api/ws/ticket?scope=api", wsTicketFromApiEndpoint, "api");
            runTicket("GET /ws/ticket?scope=presence", wsTicketFromWsEndpoint, "presence");
            runTicket("GET /api/ws/ticket?scope=presence", wsTicketFromApiEndpoint, "presence");
            runTicket("GET /ws/ticket?scope=game", wsTicketFromWsEndpoint, "game");
            runTicket("GET /api/ws/ticket?scope=game", wsTicketFromApiEndpoint, "game");
            runTicket("GET /ws/ticket?scope=notify", wsTicketFromWsEndpoint, "notify");
            runTicket("GET /api/ws/ticket?scope=notify", wsTicketFromApiEndpoint, "notify");
            runWs("WS /ws/api", wsEndpoint, "api");
            runWs("WS /presence?context=chat", wsPresenceEndpoint, "presence");
            runWs("WS /ws/game", wsGameEndpoint, "game");
            runWs("WS /ws/notify", wsNotifyEndpoint, "notify");
            if (hasToken)
            {
                CheckApiCapabilities(wsEndpoint, bearerToken, clientVersion, ticketProvider, checks);
            }
            else
            {
                AddCheck(checks, "api.capabilities", false, "Session absente");
            }

            return checks;
        },
        [weakSelf, requestId](std::string errorMessage, std::optional<std::vector<ConnectionCheck>> checks) mutable
        {
            if (!weakSelf || weakSelf->connectionTestRequestId_ != requestId)
            {
                return;
            }

            weakSelf->isConnectionTestRunning_ = false;
            if (weakSelf->testConnectionButton_ != nullptr)
            {
                weakSelf->testConnectionButton_->Enable(true);
            }

            std::string report = "Erreur inattendue du moteur de diagnostic : " + errorMessage;
            if (!checks.has_value())
            {
                weakSelf->diagnosticsOutput_->SetValue(wxString::FromUTF8(report));
                weakSelf->diagnosticsOutput_->SetInsertionPointEnd();
                return;
            }

            if (!errorMessage.empty() && !checks->empty())
            {
                AddCheck(*checks, "Worker", false, errorMessage);
            }

            report = BuildConnectionReport(*checks);
            weakSelf->diagnosticsOutput_->SetValue(wxString::FromUTF8(report));
            weakSelf->diagnosticsOutput_->SetInsertionPointEnd();
            lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(
                *weakSelf->diagnosticsOutput_,
                weakSelf->diagnosticsOutput_->GetValue());
        });
}

void ChatFrame::InvalidateOpenChatRequest()
{
    ++activeOpenChatRequestId_;
}

void ChatFrame::RequestCloseToSession()
{
    isReturningToSession_ = true;
    if (onCloseRequested_)
    {
        onCloseRequested_();
    }
}

void ChatFrame::ShowAccessibleErrorDialog(const wxString& message, const wxString& title)
{
    const wxString safeMessage = message.empty()
        ? wxString::FromUTF8(lila::shared::errors::UnexpectedError)
        : message;
    wxMessageDialog dialog(
        this,
        safeMessage,
        title.empty() ? wxString::FromUTF8(lila::shared::errors::ChatFrameHeader) : title,
        wxOK | wxICON_WARNING | wxSTAY_ON_TOP | wxCENTRE);
    dialog.SetEscapeId(wxID_OK);
    dialog.ShowModal();
}
}
