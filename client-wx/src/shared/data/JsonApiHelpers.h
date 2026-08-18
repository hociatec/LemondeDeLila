#pragma once

#include "shared/contracts/BackendWsContracts.h"
#include "shared/data/JsonReaders.h"
#include "shared/errors/ErrorMessages.h"

#include <nlohmann/json.hpp>
#include <stdexcept>
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
        catch (...)
        {
            throw std::runtime_error(errorMessage);
        }
    }

    throw std::runtime_error(errorMessage);
}
}
