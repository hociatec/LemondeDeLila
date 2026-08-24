#include "shared/network/realtime/RealtimeApiClient.h"

#include <stdexcept>

#include "shared/network/realtime/RealtimeProtocol.h"

namespace lila::shared::network::realtime
{
RealtimeApiClient::RealtimeApiClient(
    std::string endpoint,
    websocket::WebSocketHeaders headers,
    websocket::IWebSocketClient& webSocketClient)
    : endpoint_(std::move(endpoint)),
      headers_(std::move(headers)),
      webSocketClient_(webSocketClient)
{
}

void RealtimeApiClient::WarmUp()
{
    std::scoped_lock requestLock(requestMutex_);
    webSocketClient_.Connect(endpoint_, headers_);
}

RealtimeApiResponse RealtimeApiClient::Send(const RealtimeApiRequest& request)
{
    std::scoped_lock requestLock(requestMutex_);
    RealtimeApiResponse response;
    response.type = request.type;

    try
    {
        const std::string requestId = protocol::GenerateRequestId();
        const std::string envelope = protocol::BuildEnvelope(request, requestId);
        const auto rawJson = webSocketClient_.SendAndReceive(endpoint_, envelope, headers_);
        return protocol::ParseResponse(rawJson, requestId, request.type);
    }
    catch (const protocol::RealtimeProtocolError& exception)
    {
        response.errorKind = RealtimeErrorKind::Protocol;
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

bool RealtimeApiResponse::IsType(const std::string& expectedType) const
{
    return type == expectedType;
}
}
