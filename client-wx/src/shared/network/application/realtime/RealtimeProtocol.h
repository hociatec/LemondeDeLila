#pragma once

#include <string>
#include <stdexcept>

#include "shared/network/application/realtime/RealtimeApiClient.h"

namespace lila::shared::network::realtime
{
namespace protocol
{
class RealtimeProtocolError final : public std::runtime_error
{
public:
    using std::runtime_error::runtime_error;
};

// The realtime protocol owns JSON envelopes, request correlation and response parsing.
// Transport implementations must only send and receive UTF-8 text frames.
[[nodiscard]] std::string GenerateRequestId();
[[nodiscard]] std::string BuildEnvelope(const RealtimeApiRequest& request, const std::string& requestId);
[[nodiscard]] bool IsResponseForRequest(
    const std::string& rawJson,
    const std::string& expectedRequestId,
    const std::string& expectedType);
[[nodiscard]] RealtimeApiResponse ParseResponse(
    const std::string& rawJson,
    const std::string& expectedRequestId,
    const std::string& fallbackType);
}
}
