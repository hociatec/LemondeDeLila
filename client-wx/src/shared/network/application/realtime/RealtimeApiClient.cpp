#include "shared/network/application/realtime/RealtimeApiClient.h"

#include <stdexcept>
#include <chrono>

#include "shared/network/application/realtime/RealtimeProtocol.h"

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

RealtimeApiResponse RealtimeApiClient::Send(
    const RealtimeApiRequest& request,
    std::stop_token stopToken)
{
    RealtimeApiResponse response;
    response.type = request.type;

    std::unique_lock<std::timed_mutex> requestLock(requestMutex_, std::defer_lock);
    while (!requestLock.try_lock_for(std::chrono::milliseconds(25)))
    {
        if (stopToken.stop_requested())
        {
            response.errorKind = RealtimeErrorKind::Cancelled;
            response.errorMessage = "WebSocket operation cancelled.";
            return response;
        }
    }

    try
    {
        if (stopToken.stop_requested())
        {
            response.errorKind = RealtimeErrorKind::Cancelled;
            response.errorMessage = "WebSocket operation cancelled.";
            return response;
        }
        const std::string requestId = protocol::GenerateRequestId();
        const std::string envelope = protocol::BuildEnvelope(request, requestId);
        const auto rawJson = webSocketClient_.SendAndReceive(
            endpoint_, envelope, headers_, stopToken);
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
        response.errorKind = stopToken.stop_requested()
            ? RealtimeErrorKind::Cancelled
            : RealtimeErrorKind::Transport;
        response.errorMessage = exception.what();
        return response;
    }
}

bool RealtimeApiResponse::IsType(const std::string& expectedType) const
{
    return type == expectedType;
}
}
