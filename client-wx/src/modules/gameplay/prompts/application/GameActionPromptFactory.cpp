#include "modules/gameplay/prompts/application/GameActionPromptFactory.h"

#include <algorithm>
namespace lila::modules::gameplay::application
{
namespace
{
domain::GamePromptField Field(const domain::GameInputDescriptor& input)
{
    domain::GamePromptField field;
    field.key = input.key;
    field.label = input.label;
    field.kind = input.type.empty() ? "json" : input.type;
    field.initialText = input.initialText;
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
    if (descriptor->label.empty()) return std::nullopt;
    prompt.title = descriptor->label;
    prompt.label = prompt.title;
    prompt.paginatedCandidates = descriptor->paginatedCandidates;
    for (const auto& property : descriptor->input->properties)
    {
        if (action.payload.contains(property.key)) continue;
        auto field = Field(property);
        if (field.key.empty() || field.label.empty() || field.kind.empty())
            continue;
        prompt.fields.push_back(std::move(field));
    }
    return prompt.fields.empty() && !prompt.paginatedCandidates ? std::nullopt
                                 : std::optional<domain::GamePrompt>(std::move(prompt));
}
}
