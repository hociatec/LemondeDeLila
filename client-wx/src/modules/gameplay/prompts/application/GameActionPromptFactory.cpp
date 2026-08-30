#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"

#include <algorithm>
#include <cctype>

namespace lila::modules::gameplay::application
{
namespace
{
std::string Humanize(std::string value)
{
    for (auto& character : value)
        if (character == '_' || character == '-' || character == '.') character = ' ';
    if (!value.empty()) value[0] = static_cast<char>(std::toupper(
        static_cast<unsigned char>(value[0])));
    return value;
}

domain::GamePromptField Field(const domain::GameInputDescriptor& input)
{
    domain::GamePromptField field;
    field.key = input.key;
    field.label = input.label.empty() ? Humanize(input.key) : input.label;
    field.kind = input.type.empty() ? "json" : input.type;
    field.minimum = input.minimum;
    field.maximum = input.maximum;
    field.optional = input.optional;
    field.integer = input.integer;
    field.multiple = input.multiple || field.kind == "many" || field.kind == "players";
    field.ordering = field.kind == "ordering";
    field.minimumSelections = input.minimum ? std::max(0, static_cast<int>(*input.minimum)) : 0;
    field.maximumSelections = input.maximum ? std::max(0, static_cast<int>(*input.maximum)) : 0;
    field.choices = input.choices;
    return field;
}
}

std::optional<domain::GamePrompt> GameActionPromptFactory::Build(
    const domain::GameAction& action,
    const std::vector<domain::GameActionDescriptor>& actionCatalog)
{
    const auto descriptor = std::find_if(actionCatalog.begin(), actionCatalog.end(),
        [&action](const domain::GameActionDescriptor& candidate)
        { return candidate.type == action.type; });
    if (descriptor == actionCatalog.end() || !descriptor->input ||
        descriptor->input->type != "object") return std::nullopt;
    domain::GamePrompt prompt;
    prompt.actionType = action.type;
    prompt.title = descriptor->label.empty() ? Humanize(action.type) : descriptor->label;
    prompt.label = prompt.title;
    for (const auto& property : descriptor->input->properties)
    {
        if (action.payload.contains(property.key)) continue;
        prompt.fields.push_back(Field(property));
    }
    return prompt.fields.empty() ? std::nullopt
                                 : std::optional<domain::GamePrompt>(std::move(prompt));
}
}
