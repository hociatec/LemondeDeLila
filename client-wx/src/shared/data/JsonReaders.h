#pragma once

#include <cstdint>
#include <stdexcept>
#include <string>

#include <nlohmann/json.hpp>

#include "shared/errors/AppError.h"
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
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                lila::shared::errors::ErrorCode::JsonCorrupted,
                context,
                lila::shared::errors::WithDetails(context, error.what())));
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
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeStringSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
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
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeIntegerSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }

    return iterator->get<int>();
}

inline std::int64_t ReadOptionalInteger64(
    const nlohmann::json& source,
    const char* fieldName,
    std::int64_t defaultValue = 0)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || iterator->is_null()) return defaultValue;
    if (!iterator->is_number_integer())
    {
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeIntegerSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(
                lila::shared::errors::ErrorCode::JsonCorrupted,
                message,
                message));
    }
    return iterator->get<std::int64_t>();
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
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNamePrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeBooleanSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }

    return iterator->get<bool>();
}

inline void EnsureObjectOrNull(const nlohmann::json& source, const char* message)
{
    if (!source.is_object() && !source.is_null())
    {
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }
}

inline void EnsureObject(const nlohmann::json& source, const char* message)
{
    if (!source.is_object())
    {
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }
}

inline std::string ReadRequiredString(const nlohmann::json& source, const char* fieldName)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || !iterator->is_string())
    {
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNameRequiredPrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeStringRequiredSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }

    return iterator->get<std::string>();
}

inline int ReadRequiredInteger(const nlohmann::json& source, const char* fieldName)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || !iterator->is_number_integer())
    {
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNameRequiredPrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeIntegerRequiredSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }

    return iterator->get<int>();
}

inline bool ReadRequiredBool(const nlohmann::json& source, const char* fieldName)
{
    const auto iterator = source.find(fieldName);
    if (iterator == source.end() || !iterator->is_boolean())
    {
        const std::string message =
            std::string(lila::shared::errors::JsonFieldNameRequiredPrefix) + fieldName
            + lila::shared::errors::JsonFieldTypeBooleanSuffix;
        throw lila::shared::errors::AppException(
            lila::shared::errors::ToAppError(lila::shared::errors::ErrorCode::JsonCorrupted, message, message));
    }

    return iterator->get<bool>();
}

}

