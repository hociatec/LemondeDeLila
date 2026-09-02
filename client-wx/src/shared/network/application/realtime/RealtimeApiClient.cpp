#include "shared/network/application/realtime/RealtimeApiClient.h"

#include <optional>
#include <stdexcept>

#include "shared/network/application/realtime/RealtimeClientSupport.h"
#include "shared/network/application/realtime/RealtimeProtocol.h"

namespace lila::shared::network::realtime
{
RealtimeApiClient::RealtimeApiClient(
    std::string endpoint,
    websocket::WebSocketHeaders headers,
    websocket::IWebSocketClient& webSocketClient,
    std::chrono::milliseconds requestTimeout)
    : endpoint_(std::move(endpoint)),
      headers_(std::move(headers)),
      webSocketClient_(webSocketClient),
      requestTimeout_(requestTimeout)
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
    std::unique_lock<std::timed_mutex> requestLock(requestMutex_, std::defer_lock);
    if (!detail::AcquireRequestLock(requestLock, stopToken))
        return detail::ErrorResponse(
            request.type, RealtimeErrorKind::Cancelled, detail::OperationCancelled);

    std::optional<detail::RealtimeRequestDeadline> deadline;
    try
    {
        if (stopToken.stop_requested())
            return detail::ErrorResponse(
                request.type, RealtimeErrorKind::Cancelled, detail::OperationCancelled);
        const std::string requestId = protocol::GenerateRequestId();
        const std::string envelope = protocol::BuildEnvelope(request, requestId);
        deadline.emplace(webSocketClient_, requestTimeout_);
        const auto rawJson = webSocketClient_.SendAndReceive(
            endpoint_, envelope, headers_, stopToken);
        return protocol::ParseResponse(
            rawJson,
            requestId,
            request.type,
            request.expectedResponseType);
    }
    catch (const protocol::RealtimeProtocolError& exception)
    {
        return detail::ErrorResponse(
            request.type, RealtimeErrorKind::Protocol, exception.what());
    }
    catch (const std::exception& exception)
    {
        return detail::DeadlineErrorResponse(
            request.type,
            stopToken,
            deadline.has_value() && deadline->TimedOut(),
            exception);
    }
}

}
