#include "modules/gameplay/state/infrastructure/GameStateSectionsDecoder.h"

#include <utility>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "shared/data/json/JsonCoercion.h"

namespace lila::modules::gameplay::infrastructure::detail
{
namespace
{
nlohmann::json ActionPayload(const nlohmann::json& action)
{
    return ObjectOrEmpty(action.value("payload", nlohmann::json::object()));
}

}

std::vector<domain::GameAction> DecodeActions(const nlohmann::json& payload)
{
    std::vector<domain::GameAction> result;
    const auto actions = payload.find("actions");
    if (actions == payload.end() || !actions->is_array()) return result;
    for (const auto& raw : *actions)
    {
        if (!raw.is_object()) continue;
        domain::GameAction action;
        action.type = ReadString(raw, "type");
        action.label = ReadString(raw, "label");
        action.payload = ActionPayload(raw);
        action.disabled = ReadBool(raw, "disabled");
        action.confirm = ReadBool(raw, "confirm");
        if (!action.type.empty()) result.push_back(std::move(action));
    }
    return result;
}

std::vector<domain::GameShortcut> DecodeShortcuts(const nlohmann::json& system)
{
    std::vector<domain::GameShortcut> result;
    const auto shortcuts = system.find("shortcuts");
    if (shortcuts == system.end() || !shortcuts->is_array()) return result;
    for (const auto& raw : *shortcuts)
    {
        if (!raw.is_object()) continue;
        domain::GameShortcut shortcut;
        shortcut.rawKey = ReadString(raw, "key");
        shortcut.normalizedKey = NormalizeShortcutKey(shortcut.rawKey);
        const auto type = ToUpper(Trim(ReadString(raw, "type")));
        if (type == "INTERFACE") shortcut.kind = domain::GameShortcutKind::Interface;
        else if (type == "ACTION") shortcut.kind = domain::GameShortcutKind::Action;
        shortcut.id = ReadString(raw, "id");
        shortcut.actionType = ReadString(raw, "actionType");
        shortcut.label = ReadString(raw, "label");
        if (!shortcut.normalizedKey.empty() && shortcut.kind != domain::GameShortcutKind::Unknown)
            result.push_back(std::move(shortcut));
    }
    return result;
}

std::optional<domain::GamePrompt> DecodePrompt(const nlohmann::json& stateNode)
{
    const auto pending = stateNode.find("pending");
    if (pending == stateNode.end() || !pending->is_object()) return std::nullopt;
    const auto data = pending->find("data");
    if (data == pending->end() || !data->is_object()) return std::nullopt;
    const auto fields = data->find("fields");

    domain::GamePrompt prompt;
    prompt.title = ReadString(*data, "title");
    prompt.label = ReadString(*pending, "label");
    prompt.actionType = ReadString(*data, "actionType");
    prompt.cancelActionType = ReadString(*data, "cancelActionType");
    if (prompt.actionType.empty() || fields == data->end() || !fields->is_array()) return std::nullopt;
    for (const auto& raw : *fields)
    {
        if (!raw.is_object()) continue;
        domain::GamePromptField field;
        field.key = ReadString(raw, "key");
        field.label = ReadString(raw, "label");
        field.kind = ReadString(raw, "kind");
        field.initialText = ReadString(raw, "initialText");
        field.minimum = lila::shared::data::json::ReadOptionalIntegerCoerced(raw, "min");
        field.maximum = lila::shared::data::json::ReadOptionalIntegerCoerced(raw, "max");
        field.integer = ReadBool(raw, "integer");
        field.optional = ReadBool(raw, "optional");
        field.multiple = ReadBool(raw, "multiple");
        field.ordering = ReadBool(raw, "ordering");
        field.minimumSelections = lila::shared::data::json::ReadOptionalIntegerCoerced(
            raw, "minSelections").value_or(0);
        field.maximumSelections = lila::shared::data::json::ReadOptionalIntegerCoerced(
            raw, "maxSelections").value_or(0);
        const auto choices = raw.find("choices");
        if (choices != raw.end() && choices->is_array())
            for (const auto& choice : *choices)
                field.choices.push_back(DecodeGameValue(choice));
        if (!field.key.empty() && !field.label.empty())
            prompt.fields.push_back(std::move(field));
    }
    return prompt.fields.empty() ? std::nullopt : std::optional<domain::GamePrompt>(std::move(prompt));
}

std::string NormalizeShortcutKey(std::string rawKey)
{
    rawKey = Trim(std::move(rawKey));
    constexpr char Prefix[] = "pressed ";
    if (rawKey.size() >= sizeof(Prefix) - 1 &&
        ToUpper(rawKey.substr(0, sizeof(Prefix) - 1)) == "PRESSED ")
        rawKey = Trim(rawKey.substr(sizeof(Prefix) - 1));
    rawKey = ToUpper(rawKey);
    if (rawKey == "RETURN") return "ENTER";
    if (rawKey == "BACKSPACE") return "BACK";
    return rawKey;
}
}
