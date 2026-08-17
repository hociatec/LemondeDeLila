#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"

#include <stdexcept>
#include <utility>

#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/realtime/RealtimeProtocol.h"

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
    const std::string& bearerToken) const
{
    RealtimeApiResponse response;
    response.type = request.type;

    try
    {
        websocket::WebSocketHeaders headers;
        if (!clientVersion_.empty())
        {
            headers.emplace("x-lila-client-version", clientVersion_);
        }

        if (!bearerToken.empty())
        {
            headers.emplace("Authorization", "Bearer " + bearerToken);
            headers.emplace("x-lila-ws-ticket", wsTicketProvider_.GetTicket("api", bearerToken));
        }

        const std::string requestId = protocol::GenerateRequestId();
        const std::string envelope = protocol::BuildEnvelope(request, requestId);
        const auto rawJson = webSocketClient_.SendAndReceive(endpoint_, envelope, headers);
        return protocol::ParseResponse(rawJson, requestId, request.type);
    }
    catch (const protocol::RealtimeProtocolError& exception)
    {
        response.errorKind = RealtimeErrorKind::Protocol;
        response.errorMessage = exception.what();
        return response;
    }
    catch (const http::WsTicketRequestError& exception)
    {
        response.errorKind = RealtimeErrorKind::Authentication;
        response.statusCode = exception.StatusCode();
        response.errorMessage = exception.what();
        return response;
    }
    catch (const std::exception& exception)
    {
        response.errorKind = RealtimeErrorKind::Transport;
        response.errorMessage = exception.what();
        return response;
    }
}
}
