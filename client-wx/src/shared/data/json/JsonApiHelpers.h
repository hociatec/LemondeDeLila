#pragma once

#include "shared/data/json/JsonReaders.h"

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
