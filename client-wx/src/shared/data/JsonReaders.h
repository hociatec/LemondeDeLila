#pragma once

#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

#include "shared/errors/ErrorMessages.h"

namespace lila::shared::data::json {

inline nlohmann::json ParseDocument(const std::string& raw, const char* context)
{
    try
    {
        return nlohmann::json::parse(raw);
    }
    catch (const nlohmann::json::exception& error)
    {
        throw std::runtime_error(std::string(context) + ": " + error.what());
    }
}

inline std::string ReadOptionalString(
    const nlohmann::json& source,
    const char* fieldName,
    std::string defaultValue = {})
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || iterator->is_null())
    {
        return defaultValue;
    }

    if (!iterator->is_string())
    {
        throw std::runtime_error(
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeStringSuffix);
    }

    return iterator->get<std::string>();
}

inline int ReadOptionalInteger(const nlohmann::json& source, const char* fieldName, int defaultValue = 0)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || iterator->is_null())
    {
        return defaultValue;
    }

    if (!iterator->is_number_integer())
    {
        throw std::runtime_error(
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeIntegerSuffix);
    }

    return iterator->get<int>();
}

inline bool ReadOptionalBool(const nlohmann::json& source, const char* fieldName, bool defaultValue)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || iterator->is_null())
    {
        return defaultValue;
    }

    if (!iterator->is_boolean())
    {
        throw std::runtime_error(
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeBooleanSuffix);
    }

    return iterator->get<bool>();
}

inline std::string ReadRequiredString(const nlohmann::json& source, const char* fieldName)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || !iterator->is_string())
    {
        throw std::runtime_error(
            std::string(lila::shared::errors::JsonFieldNameRequiredPrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeStringRequiredSuffix);
    }

    return iterator->get<std::string>();
}

inline int ReadRequiredInteger(const nlohmann::json& source, const char* fieldName)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || !iterator->is_number_integer())
    {
        throw std::runtime_error(
            std::string(lila::shared::errors::JsonFieldNameRequiredPrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeIntegerRequiredSuffix);
    }

    return iterator->get<int>();
}

}
