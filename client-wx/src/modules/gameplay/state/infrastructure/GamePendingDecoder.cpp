#include "modules/gameplay/state/infrastructure/GamePendingDecoder.h"

#include <algorithm>
#include <utility>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "shared/data/json/JsonCoercion.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::optional<domain::GameAction> DecodeMappedAction(
    const nlohmann::json& mappings,
    std::size_t index)
{
    if (!mappings.is_array() || index >= mappings.size()) return std::nullopt;
    const auto& raw = mappings[index];
    if (!raw.is_object()) return std::nullopt;
    domain::GameAction action;
    action.type = detail::ReadString(raw, "type");
    action.label = detail::ReadString(raw, "label");
    action.payload = detail::ObjectOrEmpty(
        raw.value("payload", nlohmann::json::object()));
    action.disabled = detail::ReadBool(raw, "disabled");
    action.confirm = detail::ReadBool(raw, "confirm");
    return action.type.empty() ? std::nullopt
                               : std::optional<domain::GameAction>(std::move(action));
}
}

std::optional<domain::GamePending> GamePendingDecoder::Decode(
    const nlohmann::json& stateNode,
    const nlohmann::json& metadata,
    const nlohmann::json& extras)
{
    const auto rawPending = stateNode.find("pending");
    if (rawPending == stateNode.end() || !rawPending->is_object()) return std::nullopt;

    domain::GamePending pending;
    pending.type = detail::ReadString(*rawPending, "type");
    pending.label = detail::ReadString(*rawPending, "label");
    pending.question = detail::ReadString(*rawPending, "question");
    pending.playerId = lila::shared::data::json::ReadOptionalIntegerCoerced(*rawPending, "playerId");
    pending.targetPlayerId = lila::shared::data::json::ReadOptionalIntegerCoerced(*rawPending, "targetPlayerId");
    pending.blocking = detail::ReadBool(*rawPending, "blocking");
    pending.data = detail::ObjectOrEmpty(
        rawPending->value("data", nlohmann::json::object()));

    const auto mappings = pending.data.find("choiceActionsByIndex");
    const auto choices = rawPending->find("choices");
    if (choices != rawPending->end() && choices->is_array())
    {
        pending.choices.reserve(choices->size());
        for (std::size_t index = 0; index < choices->size(); ++index)
        {
            const auto& rawChoice = (*choices)[index];
            std::string label;
            if (rawChoice.is_string()) label = rawChoice.get<std::string>();
            else if (!rawChoice.is_null()) label = rawChoice.dump();
            if (label.empty()) continue;
            domain::GamePendingChoice choice;
            choice.label = std::move(label);
            if (mappings != pending.data.end())
                choice.action = DecodeMappedAction(*mappings, index);
            pending.choices.push_back(std::move(choice));
        }
    }

    const auto viewerId = lila::shared::data::json::ReadOptionalIntegerCoerced(extras, "viewerPlayerId");
    const bool targetsAnotherViewer = pending.playerId && viewerId &&
        *pending.playerId != *viewerId;
    const auto lifecycle = metadata.find("lifecycle");
    const bool lifecycleActionable = lifecycle != metadata.end() && lifecycle->is_object() &&
        detail::ReadBool(*lifecycle, "viewerTurnActionable");
    const bool hasMappedAction = std::any_of(
        pending.choices.begin(), pending.choices.end(),
        [](const domain::GamePendingChoice& choice) { return choice.action.has_value(); });
    pending.viewerActionable = !targetsAnotherViewer &&
        (lifecycleActionable || hasMappedAction);

    if (pending.type.empty() && pending.label.empty() && pending.question.empty() &&
        pending.choices.empty() && pending.data.empty())
        return std::nullopt;
    return pending;
}
}
