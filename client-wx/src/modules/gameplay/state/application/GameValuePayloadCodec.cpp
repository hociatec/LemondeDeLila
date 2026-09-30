#include "modules/gameplay/state/application/GameValuePayloadCodec.h"

#include <nlohmann/json.hpp>

#include <cmath>
#include <stdexcept>

namespace lila::modules::gameplay::application
{
namespace
{
constexpr std::size_t MaximumValueDepth = 32;
constexpr std::size_t MaximumCollectionSize = 1024;
constexpr std::size_t MaximumTextBytes = 16 * 1024;

domain::GameValue Decode(const nlohmann::json& raw, std::size_t depth)
{
    if (depth > MaximumValueDepth)
        throw std::runtime_error("Valeur de saisie trop profonde.");
    domain::GameValue result;
    if (raw.is_boolean()) result.value = raw.get<bool>();
    else if (raw.is_number())
    {
        const double value = raw.get<double>();
        if (!std::isfinite(value)) throw std::runtime_error("Nombre de saisie invalide.");
        result.value = value;
    }
    else if (raw.is_string())
    {
        auto value = raw.get<std::string>();
        if (value.size() > MaximumTextBytes)
            throw std::runtime_error("Texte de saisie trop volumineux.");
        result.value = std::move(value);
    }
    else if (raw.is_array())
    {
        if (raw.size() > MaximumCollectionSize)
            throw std::runtime_error("Liste de saisie trop volumineuse.");
        domain::GameValue::Array values;
        values.reserve(raw.size());
        for (const auto& value : raw) values.push_back(Decode(value, depth + 1));
        result.value = std::move(values);
    }
    else if (raw.is_object())
    {
        if (raw.size() > MaximumCollectionSize)
            throw std::runtime_error("Objet de saisie trop volumineux.");
        domain::GameValue::Object values;
        for (const auto& item : raw.items())
        {
            if (item.key().size() > MaximumTextBytes)
                throw std::runtime_error("Cle de saisie trop volumineuse.");
            values.emplace(item.key(), Decode(item.value(), depth + 1));
        }
        result.value = std::move(values);
    }
    return result;
}
}

domain::GameValue DecodeGameValuePayload(const nlohmann::json& raw)
{
    return Decode(raw, 0);
}

nlohmann::json EncodeGameValuePayload(const domain::GameValue& value)
{
    if (const auto* boolean = std::get_if<bool>(&value.value)) return *boolean;
    if (const auto* number = std::get_if<double>(&value.value)) return *number;
    if (const auto* text = std::get_if<std::string>(&value.value)) return *text;
    if (const auto* array = std::get_if<domain::GameValue::Array>(&value.value))
    {
        auto result = nlohmann::json::array();
        for (const auto& item : *array) result.push_back(EncodeGameValuePayload(item));
        return result;
    }
    if (const auto* object = std::get_if<domain::GameValue::Object>(&value.value))
    {
        auto result = nlohmann::json::object();
        for (const auto& [key, item] : *object) result[key] = EncodeGameValuePayload(item);
        return result;
    }
    return nullptr;
}
}
