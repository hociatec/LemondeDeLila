#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"

#include <optional>
#include <stdexcept>
#include <utility>

#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/domain/WebSocketConstants.h"
#include "shared/network/application/realtime/RealtimeClientSupport.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"

namespace lila::shared::network::realtime
{
AuthenticatedRealtimeApiClient::AuthenticatedRealtimeApiClient(
    std::string endpoint,
    std::string clientVersion,
    websocket::IWebSocketClient& webSocketClient,
    http::IWsTicketProvider& wsTicketProvider,
    std::chrono::milliseconds requestTimeout,
    std::string ticketScope)
    : endpoint_(std::move(endpoint)),
      clientVersion_(std::move(clientVersion)),
      webSocketClient_(webSocketClient),
      wsTicketProvider_(wsTicketProvider),
      ticketScope_(std::move(ticketScope)),
      requestTimeout_(requestTimeout)
{
}

RealtimeApiResponse AuthenticatedRealtimeApiClient::Send(
    const RealtimeApiRequest& request,
    const std::string& bearerToken,
    std::stop_token stopToken) const
{
    // Disarm/join the deadline before releasing the socket to the next caller.
    std::unique_lock<std::timed_mutex> requestLock(requestMutex_, std::defer_lock);
    std::optional<detail::RealtimeRequestDeadline> deadline;
    try
    {
        if (!detail::AcquireRequestLock(requestLock, stopToken))
            return detail::ErrorResponse(
                request.type, RealtimeErrorKind::Cancelled, detail::OperationCancelled);
        if (stopToken.stop_requested())
            return detail::ErrorResponse(
                request.type, RealtimeErrorKind::Cancelled, detail::OperationCancelled);
        websocket::WebSocketHeaders headers;
        headers.emplace(
            std::string(lila::shared::network::ws::ClientProductHeader),
            std::string(lila::shared::network::ws::ClientProduct));
        if (!clientVersion_.empty())
        {
            headers.emplace(
                std::string(lila::shared::network::ws::ClientVersionHeader),
                clientVersion_);
        }

        if (!bearerToken.empty())
        {
            headers.emplace(
                std::string(lila::shared::network::ws::AuthorizationHeader),
                std::string(lila::shared::network::ws::AuthorizationScheme) + bearerToken);
        }

        auto previousIdentity = connectedHeaders_;
        previousIdentity.erase(std::string(lila::shared::network::ws::WsTicketHeader));
        const bool reuseConnection = previousIdentity == headers &&
            webSocketClient_.IsConnectedTo(endpoint_, connectedHeaders_);
        if (!reuseConnection)
        {
            connectedHeaders_.clear();
            if (!bearerToken.empty())
                headers.emplace(
                    std::string(lila::shared::network::ws::WsTicketHeader),
                    wsTicketProvider_.GetTicket(ticketScope_, bearerToken));
        }

        const std::string requestId = protocol::GenerateRequestId();
        const std::string envelope = protocol::BuildEnvelope(request, requestId);
        deadline.emplace(webSocketClient_, requestTimeout_);
        std::stop_callback cancelOperation(
            stopToken,
            [this]() { webSocketClient_.CancelPendingOperation(); });
        if (!reuseConnection)
        {
            webSocketClient_.Connect(endpoint_, headers, stopToken);
            connectedHeaders_ = std::move(headers);
        }
        if (stopToken.stop_requested()) throw std::runtime_error("WebSocket operation cancelled.");
        webSocketClient_.Send(envelope);
        while (!stopToken.stop_requested())
        {
            const auto rawJson = webSocketClient_.Receive();
            if (!protocol::IsResponseForRequest(
                    rawJson,
                    requestId,
                    request.type,
                    request.expectedResponseType)) continue;
            auto response = protocol::ParseResponse(
                rawJson,
                requestId,
                request.type,
                request.expectedResponseType);
            if (response.statusCode == 401 || response.statusCode == 403)
                connectedHeaders_.clear();
            return response;
        }
        throw std::runtime_error("WebSocket operation cancelled.");
    }
    catch (const protocol::RealtimeProtocolError& exception)
    {
        connectedHeaders_.clear();
        return detail::ErrorResponse(
            request.type, RealtimeErrorKind::Protocol, exception.what());
    }
    catch (const http::WsTicketRequestError& exception)
    {
        connectedHeaders_.clear();
        return detail::ErrorResponse(
            request.type,
            RealtimeErrorKind::Authentication,
            exception.what(),
            exception.StatusCode());
    }
    catch (const std::exception& exception)
    {
        if (requestLock.owns_lock()) connectedHeaders_.clear();
        return detail::DeadlineErrorResponse(
            request.type,
            stopToken,
            deadline.has_value() && deadline->TimedOut(),
            exception);
    }
}
}
