#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"

#include <cctype>

#include <nlohmann/json.hpp>

namespace lila::modules::gameplay::application
{
namespace
{
std::string Text(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    return found != object.end() && found->is_string()
        ? found->get<std::string>() : std::string{};
}

std::string Humanize(std::string value)
{
    for (auto& character : value)
        if (character == '_' || character == '-' || character == '.') character = ' ';
    if (!value.empty()) value[0] = static_cast<char>(std::toupper(
        static_cast<unsigned char>(value[0])));
    return value;
}
}

std::optional<domain::GamePrompt> GameActionPromptFactory::Build(
    const domain::GameAction& action,
    const nlohmann::json& actionCatalog)
{
    if (!actionCatalog.is_array()) return std::nullopt;
    for (const auto& descriptor : actionCatalog)
    {
        if (!descriptor.is_object() || Text(descriptor, "type") != action.type) continue;
        const auto input = descriptor.find("input");
        if (input == descriptor.end() || !input->is_object() || Text(*input, "type") != "object")
            return std::nullopt;
        const auto properties = input->find("properties");
        if (properties == input->end() || !properties->is_object()) return std::nullopt;
        domain::GamePrompt prompt;
        prompt.actionType = action.type;
        const auto ui = descriptor.find("ui");
        prompt.title = ui != descriptor.end() && ui->is_object()
            ? Text(*ui, "label") : Humanize(action.type);
        prompt.label = prompt.title;
        for (const auto& property : properties->items())
        {
            if (!property.value().is_object() || action.payload.contains(property.key())) continue;
            if (property.value().value("optional", false)) continue;
            domain::GamePromptField field;
            field.key = property.key();
            field.label = Humanize(property.key());
            field.schema = property.value();
            field.kind = Text(property.value(), "type");
            if (field.kind.empty() && property.value().contains("oneOf")) field.kind = "json";
            field.integer = property.value().value("integer", false);
            const auto choices = property.value().find("values");
            const auto numberChoices = property.value().find("enum");
            if (choices != property.value().end() && choices->is_array())
                for (const auto& choice : *choices) field.choices.push_back(choice);
            else if (numberChoices != property.value().end() && numberChoices->is_array())
                for (const auto& choice : *numberChoices) field.choices.push_back(choice);
            else if (field.kind == "literal" && property.value().contains("value"))
                field.choices.push_back(property.value()["value"]);
            const auto minimum = property.value().find("min");
            const auto maximum = property.value().find("max");
            if (minimum != property.value().end() && minimum->is_number())
                field.minimum = minimum->get<double>();
            if (maximum != property.value().end() && maximum->is_number())
                field.maximum = maximum->get<double>();
            prompt.fields.push_back(std::move(field));
        }
        return prompt.fields.empty() ? std::nullopt
            : std::optional<domain::GamePrompt>(std::move(prompt));
    }
    return std::nullopt;
}
}
