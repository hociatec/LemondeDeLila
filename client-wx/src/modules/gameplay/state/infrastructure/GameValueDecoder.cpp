#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

#include <nlohmann/json.hpp>
#include <stdexcept>

namespace lila::modules::gameplay::infrastructure
{
namespace
{
constexpr std::size_t MaximumValueDepth = 32;
constexpr std::size_t MaximumCollectionItems = 1024;
constexpr std::size_t MaximumTextBytes = 16 * 1024;

domain::GameValue Decode(const nlohmann::json& raw, std::size_t depth)
{
    if (depth > MaximumValueDepth)
        throw std::runtime_error("Valeur gameplay trop profonde.");
    domain::GameValue result;
    if (raw.is_boolean()) result.value = raw.get<bool>();
    else if (raw.is_number()) result.value = raw.get<double>();
    else if (raw.is_string())
    {
        auto text = raw.get<std::string>();
        if (text.size() > MaximumTextBytes)
            throw std::runtime_error("Texte gameplay trop volumineux.");
        result.value = std::move(text);
    }
    else if (raw.is_array())
    {
        if (raw.size() > MaximumCollectionItems)
            throw std::runtime_error("Tableau gameplay trop volumineux.");
        domain::GameValue::Array values;
        values.reserve(raw.size());
        for (const auto& value : raw) values.push_back(Decode(value, depth + 1));
        result.value = std::move(values);
    }
    else if (raw.is_object())
    {
        if (raw.size() > MaximumCollectionItems)
            throw std::runtime_error("Objet gameplay trop volumineux.");
        domain::GameValue::Object values;
        for (const auto& item : raw.items())
        {
            if (item.key().size() > MaximumTextBytes)
                throw std::runtime_error("Cle gameplay trop volumineuse.");
            values.emplace(item.key(), Decode(item.value(), depth + 1));
        }
        result.value = std::move(values);
    }
    return result;
}
}

domain::GameValue DecodeGameValue(const nlohmann::json& raw)
{
    return Decode(raw, 0);
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
