#include "shared/network/realtime/AuthenticatedRealtimeApiClient.h"

#include <stdexcept>
#include <utility>

#include "shared/network/http/WsTicketProvider.h"
#include "shared/contracts/BackendWsContracts.h"
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
            headers.emplace(
                std::string(lila::shared::contracts::ws::ClientVersionHeader),
                clientVersion_);
        }

        if (!bearerToken.empty())
        {
            headers.emplace(
                std::string(lila::shared::contracts::ws::AuthorizationHeader),
                std::string(lila::shared::contracts::ws::AuthorizationScheme) + bearerToken);
            headers.emplace(
                std::string(lila::shared::contracts::ws::WsTicketHeader),
                wsTicketProvider_.GetTicket(
                    std::string(lila::shared::contracts::ws::WsTicketScopeApi),
                    bearerToken));
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
