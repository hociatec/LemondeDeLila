#include "modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.h"

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::optional<double> Number(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    return found != object.end() && found->is_number()
        ? std::optional<double>(found->get<double>()) : std::nullopt;
}

domain::GameInputDescriptor Input(const nlohmann::json& raw, std::string key = {})
{
    domain::GameInputDescriptor result;
    result.key = std::move(key);
    result.type = detail::ReadString(raw, "type");
    result.label = detail::ReadString(raw, "label");
    result.description = detail::ReadString(raw, "description");
    result.initialText = detail::ReadString(raw, "initialText");
    result.optional = detail::ReadBool(raw, "optional");
    result.integer = detail::ReadBool(raw, "integer") || result.type == "integer";
    result.multiple = detail::ReadBool(raw, "multiple");
    result.minimum = Number(raw, "min");
    result.maximum = Number(raw, "max");
    const auto appendChoices = [&result](const nlohmann::json& values)
    {
        if (!values.is_array()) return;
        for (const auto& value : values) result.choices.push_back(DecodeGameValue(value));
    };
    const auto values = raw.find("values");
    const auto enumerated = raw.find("enum");
    if (values != raw.end()) appendChoices(*values);
    else if (enumerated != raw.end()) appendChoices(*enumerated);
    else if (result.type == "literal")
    {
        const auto value = raw.find("value");
        if (value != raw.end()) result.choices.push_back(DecodeGameValue(*value));
    }
    const auto items = raw.find("items");
    if (items != raw.end() && items->is_object())
    {
        const auto itemValues = items->find("values");
        const auto itemEnum = items->find("enum");
        if (itemValues != items->end()) appendChoices(*itemValues);
        else if (itemEnum != items->end()) appendChoices(*itemEnum);
        if (!result.choices.empty()) result.multiple = true;
    }
    const auto properties = raw.find("properties");
    if (properties != raw.end() && properties->is_object())
        for (const auto& property : properties->items())
            if (property.value().is_object())
                result.properties.push_back(Input(property.value(), property.key()));
    return result;
}
}

std::vector<domain::GameActionDescriptor> GameActionCatalogDecoder::Decode(
    const nlohmann::json& raw)
{
    std::vector<domain::GameActionDescriptor> result;
    if (!raw.is_array()) return result;
    for (const auto& item : raw)
    {
        if (!item.is_object()) continue;
        domain::GameActionDescriptor descriptor;
        descriptor.type = detail::ReadString(item, "type");
        descriptor.documentation = detail::ReadString(item, "documentation");
        descriptor.description = detail::ReadString(item, "description");
        descriptor.confirm = detail::ReadBool(item, "confirm");
        descriptor.paginatedCandidates = detail::ReadBool(item, "paginatedCandidates");
        const auto ui = item.find("ui");
        if (ui != item.end() && ui->is_object())
        {
            descriptor.label = detail::ReadString(*ui, "label");
            descriptor.control = detail::ReadString(*ui, "control");
            if (descriptor.description.empty())
                descriptor.description = detail::ReadString(*ui, "description");
            descriptor.confirm = descriptor.confirm || detail::ReadBool(*ui, "confirm");
        }
        const auto input = item.find("input");
        if (input != item.end() && input->is_object()) descriptor.input = Input(*input);
        if (!descriptor.type.empty()) result.push_back(std::move(descriptor));
    }
    return result;
}
}
