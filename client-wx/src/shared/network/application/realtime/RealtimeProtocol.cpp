#include "shared/network/application/realtime/RealtimeProtocol.h"
#include "shared/network/application/realtime/RealtimeProtocolFields.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/data/json/JsonReaders.h"
#include "shared/errors/catalog/ErrorMessages.h"

#include <random>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

namespace
{
}

namespace lila::shared::network::realtime::protocol
{
std::string GenerateRequestId()
{
    static constexpr char Alphabet[] = "0123456789abcdef";

    std::random_device device;
    std::mt19937 generator(device());
    std::uniform_int_distribution<int> distribution(0, 15);

    std::string value(32, '0');
    for (char& c : value)
    {
        c = Alphabet[distribution(generator)];
    }

    return value;
}

std::string BuildEnvelope(const RealtimeApiRequest& request, const std::string& requestId)
{
    nlohmann::json envelope = {
        {lila::shared::network::realtime::fields::Type.data(), request.type},
        {lila::shared::network::realtime::fields::RequestId.data(), requestId},
        {lila::shared::network::realtime::fields::ProtocolVersion.data(), lila::shared::config::AppConfig::RealtimeProtocolVersion},
        {lila::shared::network::realtime::fields::ClientVersion.data(), lila::shared::config::AppConfig::ResolveClientVersion()},
        {lila::shared::network::realtime::fields::Payload.data(), request.payload}
    };
    return envelope.dump();
}

bool IsResponseForRequest(
    const std::string& rawJson,
    const std::string& expectedRequestId,
    const std::string& expectedType)
{
    nlohmann::json decoded;
    try
    {
        decoded = lila::shared::data::json::ParseDocument(
            rawJson, lila::shared::errors::InvalidRealtimeResponse);
    }
    catch (const std::exception& error)
    {
        throw RealtimeProtocolError(error.what());
    }
    if (!decoded.is_object())
        throw RealtimeProtocolError(lila::shared::errors::InvalidRealtimeResponse);

    const auto requestId = lila::shared::data::json::ReadOptionalString(
        decoded, lila::shared::network::realtime::fields::RequestId.data());
    if (!requestId.empty()) return requestId == expectedRequestId;

    // Legacy responses may not carry a request id. Unsolicited events use a
    // different type, so they remain distinguishable from the awaited reply.
    const auto type = lila::shared::data::json::ReadOptionalString(
        decoded, lila::shared::network::realtime::fields::Type.data());
    return !expectedType.empty() && type == expectedType;
}

RealtimeApiResponse ParseResponse(
    const std::string& rawJson,
    const std::string& expectedRequestId,
    const std::string& fallbackType)
{
    nlohmann::json decoded;
    try
    {
        decoded = lila::shared::data::json::ParseDocument(rawJson, lila::shared::errors::InvalidRealtimeResponse);
    }
    catch (const std::exception& error)
    {
        throw RealtimeProtocolError(error.what());
    }
    if (!decoded.is_object())
    {
        throw RealtimeProtocolError(lila::shared::errors::InvalidRealtimeResponse);
    }

    RealtimeApiResponse response;
    response.type = lila::shared::data::json::ReadOptionalString(
        decoded, lila::shared::network::realtime::fields::Type.data());
    if (response.type.empty())
    {
        response.type = fallbackType;
    }
    if (response.type.empty())
    {
        throw RealtimeProtocolError(lila::shared::errors::InvalidRealtimeResponse);
    }

    response.requestId = lila::shared::data::json::ReadOptionalString(
        decoded, lila::shared::network::realtime::fields::RequestId.data());
    if (!response.requestId.empty() && response.requestId != expectedRequestId)
    {
        throw RealtimeProtocolError(lila::shared::errors::RealtimeRequestMismatch);
    }

    const auto payloadIterator = decoded.find(lila::shared::network::realtime::fields::Payload.data());
    if (payloadIterator == decoded.end() || payloadIterator->is_null())
    {
        response.payload = nlohmann::json::object();
    }
    else if (!payloadIterator->is_object() && !payloadIterator->is_array())
    {
        throw RealtimeProtocolError(lila::shared::errors::InvalidRealtimeResponse);
    }
    else
    {
        response.payload = *payloadIterator;
    }

    if (response.type == std::string(lila::shared::network::realtime::fields::ErrorType))
    {
        response.errorKind = RealtimeErrorKind::Server;
        response.errorMessage = lila::shared::data::json::ReadOptionalString(
            response.payload,
            lila::shared::network::realtime::fields::Message.data());
        if (response.errorMessage.empty())
        {
            response.errorMessage = lila::shared::errors::RealtimeServerError;
        }
        return response;
    }

    response.success = lila::shared::data::json::ReadOptionalBool(
        decoded, lila::shared::network::realtime::fields::Success.data(), true);
    if (!response.success)
    {
        response.errorKind = RealtimeErrorKind::Server;
        response.errorMessage = lila::shared::data::json::ReadOptionalString(
            decoded, lila::shared::network::realtime::fields::Message.data());
        if (response.errorMessage.empty() && response.payload.is_object())
        {
            response.errorMessage = lila::shared::data::json::ReadOptionalString(
                response.payload, lila::shared::network::realtime::fields::Message.data());
        }
        if (response.errorMessage.empty())
        {
            response.errorMessage = lila::shared::errors::BackendRejectedRequest;
        }
    }

    return response;
}
}
