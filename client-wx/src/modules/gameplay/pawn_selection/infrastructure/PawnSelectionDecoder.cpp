#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"

#include <algorithm>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
domain::GameAction DecodeAction(const nlohmann::json& raw)
{
    domain::GameAction action;
    if (!raw.is_object()) return action;
    action.type = detail::ReadString(raw, "type");
    action.label = detail::ReadString(raw, "label");
    const auto payload = raw.find("payload");
    if (payload != raw.end() && payload->is_object()) action.payload = *payload;
    action.disabled = detail::ReadBool(raw, "disabled");
    return action;
}

std::optional<domain::GameAction> FindValueAction(
    const std::vector<domain::GameAction>& actions,
    const nlohmann::json& value)
{
    const auto found = std::find_if(actions.begin(), actions.end(),
        [&value](const domain::GameAction& action)
        {
            const auto selected = action.payload.find("value");
            return !action.disabled && selected != action.payload.end() && *selected == value;
        });
    return found == actions.end() ? std::nullopt : std::optional<domain::GameAction>(*found);
}
}

std::optional<domain::PawnSelection> PawnSelectionDecoder::Decode(
    const nlohmann::json& stateNode,
    const std::vector<domain::GameAction>& availableActions,
    const nlohmann::json& pawnsKit)
{
    const auto pending = stateNode.find("pending");
    if (pending == stateNode.end() || !pending->is_object()) return std::nullopt;
    const auto data = pending->value("data", nlohmann::json::object());
    const auto kind = detail::ReadString(*pending, "workflowKind").empty()
        ? detail::ReadString(data, "kind") : detail::ReadString(*pending, "workflowKind");
    const auto legacyPawns = data.find("pawns");
    if (kind != "pawn" && (legacyPawns == data.end() || !legacyPawns->is_array()) &&
        pawnsKit.empty()) return std::nullopt;
    const auto choices = pending->find("choices");
    if (choices == pending->end() || !choices->is_array()) return std::nullopt;
    const auto options = data.find("options");
    const auto mapped = data.find("choiceActionsByIndex");
    domain::PawnSelection selection;
    selection.pendingType = detail::ReadString(*pending, "type");
    selection.label = detail::ReadString(*pending, "label");
    if (selection.label.empty()) selection.label = "Votre pion.";
    for (std::size_t index = 0; index < choices->size(); ++index)
    {
        if (!(*choices)[index].is_string()) continue;
        domain::PawnChoice choice;
        choice.label = (*choices)[index].get<std::string>();
        if (mapped != data.end() && mapped->is_array() && index < mapped->size())
            choice.action = DecodeAction((*mapped)[index]);
        const auto value = options != data.end() && options->is_array() && index < options->size()
            ? (*options)[index] : nlohmann::json();
        if (choice.action.type.empty() && !value.is_null())
            if (const auto action = FindValueAction(availableActions, value)) choice.action = *action;
        if (!choice.action.type.empty() && !choice.action.disabled)
            selection.choices.push_back(std::move(choice));
    }
    return selection.choices.empty() ? std::nullopt
        : std::optional<domain::PawnSelection>(std::move(selection));
}
}
