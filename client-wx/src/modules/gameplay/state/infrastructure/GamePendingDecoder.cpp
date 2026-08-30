#include "modules/gameplay/state/infrastructure/GamePendingDecoder.h"

#include <algorithm>
#include <utility>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "shared/data/json/JsonCoercion.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::vector<int> ReadIds(const nlohmann::json& object, const char* key)
{
    std::vector<int> result;
    const auto values = object.find(key);
    if (values == object.end() || !values->is_array()) return result;
    for (const auto& value : *values)
        if (value.is_number_integer()) result.push_back(value.get<int>());
    return result;
}

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
    const nlohmann::json& pendingNode,
    const std::vector<domain::GameAction>& actions)
{
    if (!pendingNode.is_object()) return std::nullopt;
    const auto& rawPending = pendingNode;

    domain::GamePending pending;
    pending.type = detail::ReadString(rawPending, "type");
    pending.label = detail::ReadString(rawPending, "label");
    pending.question = detail::ReadString(rawPending, "question");
    pending.choiceId = detail::ReadString(rawPending, "choiceId");
    pending.workflowKind = detail::ReadString(rawPending, "workflowKind");
    pending.playerId = lila::shared::data::json::ReadOptionalIntegerCoerced(rawPending, "playerId");
    pending.targetPlayerId = lila::shared::data::json::ReadOptionalIntegerCoerced(rawPending, "targetPlayerId");
    pending.playerIds = ReadIds(rawPending, "playerIds");
    pending.resolvedPlayerIds = ReadIds(rawPending, "resolvedPlayerIds");
    pending.blocking = detail::ReadBool(rawPending, "blocking");
    const auto data = detail::ObjectOrEmpty(
        rawPending.value("data", nlohmann::json::object()));
    const auto kind = detail::ReadString(data, "kind");
    if (pending.workflowKind.empty()) pending.workflowKind = kind;
    if (pending.choiceId.empty()) pending.choiceId = detail::ReadString(data, "choiceId");
    pending.multipleSelection = kind == "many" || kind == "players" || kind == "ordering";
    pending.ordering = kind == "ordering";
    pending.minimumSelections = lila::shared::data::json::ReadOptionalIntegerCoerced(
        data, "min").value_or(pending.ordering ? 0 : 1);
    pending.maximumSelections = lila::shared::data::json::ReadOptionalIntegerCoerced(
        data, "max").value_or(0);

    const auto mappings = data.find("choiceActionsByIndex");
    const auto choices = rawPending.find("choices");
    if (choices != rawPending.end() && choices->is_array())
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
            const auto options = data.find("options");
            choice.value = DecodeGameValue(
                options != data.end() && options->is_array() && index < options->size()
                    ? (*options)[index] : rawChoice);
            if (mappings != data.end())
                choice.action = DecodeMappedAction(*mappings, index);
            pending.choices.push_back(std::move(choice));
        }
    }

    if (pending.multipleSelection && pending.maximumSelections <= 0)
        pending.maximumSelections = static_cast<int>(pending.choices.size());
    if (!pending.multipleSelection) pending.maximumSelections = 1;

    const bool hasMappedAction = std::any_of(
        pending.choices.begin(), pending.choices.end(),
        [](const domain::GamePendingChoice& choice) { return choice.action.has_value(); });
    const auto explicitSelection = data.find("selectionAction");
    if (explicitSelection != data.end())
        pending.selectionAction = DecodeMappedAction(
            nlohmann::json::array({*explicitSelection}), 0);
    if (pending.multipleSelection && !pending.selectionAction)
    {
        const auto actionType = detail::ReadString(data, "selectionActionType");
        const auto templateAction = std::find_if(actions.begin(), actions.end(),
            [&actionType](const domain::GameAction& action)
            {
                return !action.disabled && action.type ==
                    (actionType.empty() ? "choice.resolve" : actionType);
            });
        if (templateAction != actions.end()) pending.selectionAction = *templateAction;
    }
    pending.viewerActionable = hasMappedAction || pending.selectionAction.has_value();

    static const std::vector<std::string> knownData{
        "kind", "choiceId", "min", "max", "options", "choiceActionsByIndex",
        "selectionAction", "selectionActionType"};
    for (const auto& item : data.items())
        if (std::find(knownData.begin(), knownData.end(), item.key()) == knownData.end())
            pending.unknownData.emplace(item.key(), DecodeGameValue(item.value()));
    if (pending.type.empty() && pending.label.empty() && pending.question.empty() &&
        pending.choices.empty() && pending.unknownData.empty())
        return std::nullopt;
    return pending;
}
}
