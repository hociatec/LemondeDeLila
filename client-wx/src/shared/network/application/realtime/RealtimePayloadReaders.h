#pragma once

#include "shared/data/json/JsonApiHelpers.h"

#include <nlohmann/json.hpp>

#include <optional>
#include <string_view>
#include <vector>

namespace lila::shared::network::realtime::payload
{
inline const nlohmann::json* ReadOptionalObjectField(
    const nlohmann::json& payload,
    std::string_view fieldName,
    const char* invalidPayloadTypeMessage,
    const char* invalidObjectFieldMessage)
{
    lila::shared::data::json::EnsureObjectOrNull(payload, invalidPayloadTypeMessage);
    return lila::shared::data::json::FindOptionalObjectStrict(
        payload,
        fieldName.data(),
        invalidObjectFieldMessage);
}

template <typename TReader>
auto ReadOptionalObjectPayload(
    const nlohmann::json& payload,
    std::string_view fieldName,
    const char* invalidPayloadTypeMessage,
    const char* invalidObjectFieldMessage,
    TReader&& reader) -> std::optional<decltype(reader(std::declval<const nlohmann::json&>()))>
{
    const auto* object = ReadOptionalObjectField(
        payload,
        fieldName,
        invalidPayloadTypeMessage,
        invalidObjectFieldMessage);
    if (object == nullptr)
    {
        return std::nullopt;
    }

    return reader(*object);
}

template <typename TValue, typename TReader>
std::vector<TValue> ReadObjectArrayPayload(
    const nlohmann::json& payload,
    std::string_view fieldName,
    const char* invalidPayloadTypeMessage,
    const char* invalidArrayFieldMessage,
    const char* invalidArrayItemMessage,
    TReader&& reader)
{
    lila::shared::data::json::EnsureObjectOrNull(payload, invalidPayloadTypeMessage);

    return lila::shared::data::json::ReadObjectArrayStrict<TValue>(
        payload,
        fieldName.data(),
        invalidArrayFieldMessage,
        invalidArrayItemMessage,
        std::forward<TReader>(reader));
}
}
