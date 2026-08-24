#pragma once

#include "shared/data/json/JsonReaders.h"
#include "shared/errors/catalog/ErrorMessages.h"

#include <nlohmann/json.hpp>
#include <functional>
#include <stdexcept>
#include <type_traits>
#include <vector>

namespace lila::shared::data::json
{
inline const nlohmann::json::array_t& EnsureArrayStrict(const nlohmann::json& document, const char* fieldName, const char* errorMessage)
{
    if (!document.is_object() || !document.contains(fieldName) || !document[fieldName].is_array())
    {
        throw std::runtime_error(errorMessage);
    }
    return document[fieldName].get_ref<const nlohmann::json::array_t&>();
}

inline std::int64_t ReadStrictTimestamp(const nlohmann::json& object, const char* key, const char* errorMessage)
{
    if (!object.contains(key))
    {
        throw std::runtime_error(errorMessage);
    }

    const auto& value = object[key];
    if (value.is_number_integer())
    {
        return value.get<std::int64_t>();
    }
    if (value.is_string())
    {
        try
        {
            return std::stoll(value.get<std::string>());
        }
        catch (const std::invalid_argument&)
        {
            throw std::runtime_error(errorMessage);
        }
        catch (const std::out_of_range&)
        {
            throw std::runtime_error(errorMessage);
        }
    }

    throw std::runtime_error(errorMessage);
}

inline const nlohmann::json* FindOptionalObjectStrict(
    const nlohmann::json& document,
    const char* fieldName,
    const char* errorMessage)
{
    if (!document.is_object())
    {
        throw std::runtime_error(errorMessage);
    }

    const auto iterator = document.find(fieldName);
    if (iterator == document.end() || iterator->is_null())
    {
        return nullptr;
    }

    if (!iterator->is_object())
    {
        throw std::runtime_error(errorMessage);
    }

    return &(*iterator);
}

inline const nlohmann::json& ReadRequiredObjectStrict(
    const nlohmann::json& document,
    const char* fieldName,
    const char* errorMessage)
{
    if (!document.is_object())
    {
        throw std::runtime_error(errorMessage);
    }

    const auto iterator = document.find(fieldName);
    if (iterator == document.end() || !iterator->is_object())
    {
        throw std::runtime_error(errorMessage);
    }

    return *iterator;
}

template <typename Value, typename Parser>
std::vector<Value> ReadObjectArrayStrict(
    const nlohmann::json& document,
    const char* fieldName,
    const char* arrayErrorMessage,
    const char* itemErrorMessage,
    Parser&& parser)
{
    const auto& items = EnsureArrayStrict(document, fieldName, arrayErrorMessage);

    std::vector<Value> values;
    values.reserve(items.size());
    for (const auto& item : items)
    {
        if (!item.is_object())
        {
            throw std::runtime_error(itemErrorMessage);
        }

        values.push_back(std::invoke(std::forward<Parser>(parser), item));
    }

    return values;
}
}
