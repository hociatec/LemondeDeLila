#include "modules/gameplay/state/infrastructure/GamePendingDecoder.h"

#include <algorithm>
#include <stdexcept>
#include <utility>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

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
        if (value.is_number_integer())
        {
            const auto id = value.get<int>();
            if (id != 0) result.push_back(id);
        }
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
    const auto payload = raw.find("payload");
    if (payload != raw.end())
    {
        auto decoded = DecodeGameValue(*payload);
        auto* object = decoded.ObjectValue();
        if (object == nullptr)
            throw std::runtime_error("Payload d'action de choix invalide.");
        action.payload = std::move(*object);
    }
    action.disabled = detail::ReadBool(raw, "disabled");
    action.confirm = detail::ReadBool(raw, "confirm");
    return action.type.empty() ? std::nullopt
                               : std::optional<domain::GameAction>(std::move(action));
}

domain::GamePendingSelectionKind SelectionKind(const std::string& kind)
{
    if (kind == "one" || kind == "single")
        return domain::GamePendingSelectionKind::Single;
    if (kind == "many") return domain::GamePendingSelectionKind::Multiple;
    if (kind == "players") return domain::GamePendingSelectionKind::Players;
    if (kind == "ordering") return domain::GamePendingSelectionKind::Ordering;
    return domain::GamePendingSelectionKind::Unknown;
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
    pending.playerId = detail::ReadOptionalPlayerId(rawPending, "playerId");
    pending.targetPlayerId = detail::ReadOptionalPlayerId(rawPending, "targetPlayerId");
    pending.playerIds = ReadIds(rawPending, "playerIds");
    pending.resolvedPlayerIds = ReadIds(rawPending, "resolvedPlayerIds");
    pending.blocking = detail::ReadBool(rawPending, "blocking");
    const auto data = detail::ObjectOrEmpty(
        rawPending.value("data", nlohmann::json::object()));
    const auto kind = detail::ReadString(data, "kind");
    pending.selectionKind = SelectionKind(kind);
    if (pending.workflowKind.empty()) pending.workflowKind = kind;
    if (pending.choiceId.empty()) pending.choiceId = detail::ReadString(data, "choiceId");
    pending.multipleSelection =
        pending.selectionKind == domain::GamePendingSelectionKind::Multiple ||
        pending.selectionKind == domain::GamePendingSelectionKind::Players ||
        pending.selectionKind == domain::GamePendingSelectionKind::Ordering;
    pending.ordering =
        pending.selectionKind == domain::GamePendingSelectionKind::Ordering;
    pending.minimumSelections = detail::ReadOptionalInt(
        data, "min").value_or(pending.ordering ? 0 : 1);
    pending.maximumSelections = detail::ReadOptionalInt(data, "max").value_or(0);

    const auto mappings = data.find("choiceActionsByIndex");
    const auto choices = rawPending.find("choices");
    if (choices != rawPending.end() && choices->is_array())
    {
        if (choices->size() > 256)
            throw std::runtime_error("Trop de choix gameplay.");
        pending.choices.reserve(choices->size());
        for (std::size_t index = 0; index < choices->size(); ++index)
        {
            const auto& rawChoice = (*choices)[index];
            std::string label;
            if (rawChoice.is_string()) label = rawChoice.get<std::string>();
            else if (!rawChoice.is_null()) label = rawChoice.dump();
            if (label.size() > 2'000)
                throw std::runtime_error("Libelle de choix trop volumineux.");
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
        if (!actionType.empty())
        {
            const auto templateAction = std::find_if(actions.begin(), actions.end(),
                [&actionType](const domain::GameAction& action)
                {
                    return !action.disabled && action.type == actionType;
                });
            if (templateAction != actions.end()) pending.selectionAction = *templateAction;
        }
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
