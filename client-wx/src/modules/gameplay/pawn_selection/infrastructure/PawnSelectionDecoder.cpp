#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"

#include <algorithm>
#include <string_view>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
using detail::ReadInt;
using detail::ReadString;

bool IsPawnPending(std::string_view type)
{
    return type == "choose_pawn" || type == "pick_pawn";
}

bool IsCompatibleAction(std::string_view type)
{
    return IsPawnPending(type) || type == "move_pawn";
}

domain::GameAction DecodeMappedAction(const nlohmann::json& value)
{
    domain::GameAction action;
    if (!value.is_object()) return action;
    action.type = ReadString(value, "type");
    const auto payload = value.find("payload");
    if (payload != value.end() && payload->is_object()) action.payload = *payload;
    return action;
}

std::string ReadPawnId(const nlohmann::json& value)
{
    for (const char* key : {"id", "pawnId", "pawn", "value"})
    {
        auto text = ReadString(value, key);
        if (!text.empty()) return text;
        const int number = ReadInt(value, key);
        if (number != 0) return std::to_string(number);
    }
    return {};
}

std::string ChoiceLabel(const nlohmann::json& pawn)
{
    auto label = ReadString(pawn, "label");
    if (label.empty()) label = ReadPawnId(pawn);
    const auto description = ReadString(pawn, "description");
    if (!description.empty()) label += " - " + description;
    return label;
}

const domain::GameAction* FindPawnAction(
    const std::vector<domain::GameAction>& actions,
    std::string_view pawnId)
{
    const auto found = std::find_if(actions.begin(), actions.end(),
        [pawnId](const domain::GameAction& action)
        {
            return IsPawnPending(action.type) && ReadPawnId(action.payload) == pawnId;
        });
    return found == actions.end() ? nullptr : &*found;
}

domain::GameAction MoveAction(
    const std::vector<domain::GameAction>& actions,
    const nlohmann::json& move)
{
    const auto found = std::find_if(actions.begin(), actions.end(),
        [](const domain::GameAction& action) { return action.type == "move_pawn"; });
    domain::GameAction action;
    action.type = found == actions.end() ? "move_pawn" : found->type;
    action.payload = {
        {"pawnIndex", ReadInt(move, "pawnIndex")},
        {"targetProgress", ReadInt(move, "targetProgress")},
    };
    return action;
}
}

std::optional<domain::PawnSelection> PawnSelectionDecoder::Decode(
    const nlohmann::json& stateNode,
    const std::vector<domain::GameAction>& availableActions)
{
    const auto pending = stateNode.find("pending");
    if (pending == stateNode.end() || !pending->is_object()) return std::nullopt;
    const auto type = ReadString(*pending, "type");
    if (!IsPawnPending(type)) return std::nullopt;

    const bool viewerCanAct = std::any_of(
        availableActions.begin(), availableActions.end(),
        [](const domain::GameAction& action)
        {
            return !action.disabled && IsCompatibleAction(action.type);
        });
    if (!viewerCanAct) return std::nullopt;

    domain::PawnSelection selection;
    selection.pendingType = type;
    selection.label = "Votre pion.";

    const auto data = pending->find("data");
    const auto choices = pending->find("choices");
    const nlohmann::json empty = nlohmann::json::object();
    const auto& dataNode = data != pending->end() && data->is_object() ? *data : empty;
    const auto mapped = dataNode.find("choiceActionsByIndex");
    const auto pawns = dataNode.find("pawns");
    const auto moves = dataNode.find("moves");

    const std::size_t count = choices != pending->end() && choices->is_array()
        ? choices->size()
        : pawns != dataNode.end() && pawns->is_array() ? pawns->size() : 0;
    for (std::size_t index = 0; index < count; ++index)
    {
        domain::PawnChoice choice;
        if (choices != pending->end() && choices->is_array() && (*choices)[index].is_string())
            choice.label = (*choices)[index].get<std::string>();
        if (choice.label.empty() && pawns != dataNode.end() && pawns->is_array())
            choice.label = ChoiceLabel((*pawns)[index]);

        if (mapped != dataNode.end() && mapped->is_array() && index < mapped->size())
            choice.action = DecodeMappedAction((*mapped)[index]);
        if (choice.action.type.empty() && pawns != dataNode.end() && pawns->is_array())
        {
            const auto pawnId = ReadPawnId((*pawns)[index]);
            if (const auto* action = FindPawnAction(availableActions, pawnId))
                choice.action = *action;
        }
        if (choice.action.type.empty() && moves != dataNode.end() && moves->is_array() &&
            index < moves->size())
            choice.action = MoveAction(availableActions, (*moves)[index]);
        if (choice.action.type.empty() && index < availableActions.size() &&
            IsCompatibleAction(availableActions[index].type))
            choice.action = availableActions[index];

        if (!choice.label.empty() && !choice.action.type.empty() && !choice.action.disabled)
            selection.choices.push_back(std::move(choice));
    }
    return selection.choices.empty()
        ? std::nullopt
        : std::optional<domain::PawnSelection>(std::move(selection));
}
}
