#include "shared/network/realtime/RealtimeProtocol.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

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
        {lila::shared::contracts::realtime::TypeField.data(), request.type},
        {lila::shared::contracts::realtime::RequestIdField.data(), requestId},
        {lila::shared::contracts::realtime::PayloadField.data(), request.payload}
    };
    return envelope.dump();
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
        decoded, lila::shared::contracts::realtime::TypeField.data());
    if (response.type.empty())
    {
        response.type = fallbackType;
    }

    response.requestId = lila::shared::data::json::ReadOptionalString(
        decoded, lila::shared::contracts::realtime::RequestIdField.data());
    if (!response.requestId.empty() && response.requestId != expectedRequestId)
    {
        throw RealtimeProtocolError(lila::shared::errors::RealtimeRequestMismatch);
    }

    const auto payloadIterator = decoded.find(lila::shared::contracts::realtime::PayloadField.data());
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

    if (response.type == std::string(lila::shared::contracts::realtime::ErrorType))
    {
        response.errorKind = RealtimeErrorKind::Server;
        response.errorMessage = lila::shared::data::json::ReadOptionalString(
            response.payload,
            lila::shared::contracts::realtime::MessageField.data());
        if (response.errorMessage.empty())
        {
            response.errorMessage = lila::shared::errors::RealtimeServerError;
        }
        return response;
    }

    response.success = lila::shared::data::json::ReadOptionalBool(
        decoded, lila::shared::contracts::realtime::SuccessField.data(), true);
    if (!response.success)
    {
        response.errorKind = RealtimeErrorKind::Server;
        response.errorMessage = lila::shared::data::json::ReadOptionalString(
            decoded, lila::shared::contracts::realtime::MessageField.data());
        if (response.errorMessage.empty() && response.payload.is_object())
        {
            response.errorMessage = lila::shared::data::json::ReadOptionalString(
                response.payload, lila::shared::contracts::realtime::MessageField.data());
        }
        if (response.errorMessage.empty())
        {
            response.errorMessage = lila::shared::errors::BackendRejectedRequest;
        }
    }

    return response;
}
}
