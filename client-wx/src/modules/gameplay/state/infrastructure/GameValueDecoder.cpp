#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::infrastructure
{
domain::GameValue DecodeGameValue(const nlohmann::json& raw)
{
    domain::GameValue result;
    if (raw.is_boolean()) result.value = raw.get<bool>();
    else if (raw.is_number()) result.value = raw.get<double>();
    else if (raw.is_string()) result.value = raw.get<std::string>();
    else if (raw.is_array())
    {
        domain::GameValue::Array values;
        values.reserve(raw.size());
        for (const auto& value : raw) values.push_back(DecodeGameValue(value));
        result.value = std::move(values);
    }
    else if (raw.is_object())
    {
        domain::GameValue::Object values;
        for (const auto& item : raw.items())
            values.emplace(item.key(), DecodeGameValue(item.value()));
        result.value = std::move(values);
    }
    return result;
}

nlohmann::json EncodeGameValue(const domain::GameValue& value)
{
    if (const auto* boolean = std::get_if<bool>(&value.value)) return *boolean;
    if (const auto* number = std::get_if<double>(&value.value)) return *number;
    if (const auto* text = std::get_if<std::string>(&value.value)) return *text;
    if (const auto* array = std::get_if<domain::GameValue::Array>(&value.value))
    {
        auto result = nlohmann::json::array();
        for (const auto& item : *array) result.push_back(EncodeGameValue(item));
        return result;
    }
    if (const auto* object = std::get_if<domain::GameValue::Object>(&value.value))
    {
        auto result = nlohmann::json::object();
        for (const auto& [key, item] : *object) result[key] = EncodeGameValue(item);
        return result;
    }
    return nullptr;
}
}
