#include "shared/network/application/realtime/AuthenticatedRealtimeApiClient.h"

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
    http::IWsTicketProvider& wsTicketProvider)
    : endpoint_(std::move(endpoint)),
      clientVersion_(std::move(clientVersion)),
      webSocketClient_(webSocketClient),
      wsTicketProvider_(wsTicketProvider)
{
}

RealtimeApiResponse AuthenticatedRealtimeApiClient::Send(
    const RealtimeApiRequest& request,
    const std::string& bearerToken,
    std::stop_token stopToken) const
{
    try
    {
        std::unique_lock<std::timed_mutex> requestLock(requestMutex_, std::defer_lock);
        if (!detail::AcquireRequestLock(requestLock, stopToken))
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
            headers.emplace(
                std::string(lila::shared::network::ws::WsTicketHeader),
                wsTicketProvider_.GetTicket(
                    std::string(lila::shared::network::ws::WsTicketScopeApi),
                    bearerToken));
        }

        const std::string requestId = protocol::GenerateRequestId();
        const std::string envelope = protocol::BuildEnvelope(request, requestId);
        std::stop_callback cancelOperation(
            stopToken,
            [this]() { webSocketClient_.CancelPendingOperation(); });
        webSocketClient_.Connect(endpoint_, headers, stopToken);
        if (stopToken.stop_requested()) throw std::runtime_error("WebSocket operation cancelled.");
        webSocketClient_.Send(envelope);
        while (!stopToken.stop_requested())
        {
            const auto rawJson = webSocketClient_.Receive();
            if (!protocol::IsResponseForRequest(rawJson, requestId, request.type)) continue;
            return protocol::ParseResponse(rawJson, requestId, request.type);
        }
        throw std::runtime_error("WebSocket operation cancelled.");
    }
    catch (const protocol::RealtimeProtocolError& exception)
    {
        return detail::ErrorResponse(
            request.type, RealtimeErrorKind::Protocol, exception.what());
    }
    catch (const http::WsTicketRequestError& exception)
    {
        return detail::ErrorResponse(
            request.type,
            RealtimeErrorKind::Authentication,
            exception.what(),
            exception.StatusCode());
    }
    catch (const std::exception& exception)
    {
        return detail::TransportErrorResponse(request.type, stopToken, exception);
    }
}
}
