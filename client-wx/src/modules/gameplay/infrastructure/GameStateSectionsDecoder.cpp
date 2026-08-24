#include "modules/gameplay/infrastructure/GameStateSectionsDecoder.h"

#include <sstream>
#include <utility>

#include "modules/gameplay/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure::detail
{
namespace
{
nlohmann::json ActionPayload(const nlohmann::json& action)
{
    return ObjectOrEmpty(action.value("payload", nlohmann::json::object()));
}

std::string CompactPayloadLabel(const nlohmann::json& payload)
{
    if (!payload.is_object() || payload.empty()) return {};
    std::ostringstream out;
    bool first = true;
    for (const auto& item : payload.items())
    {
        if (!first) out << ", ";
        first = false;
        out << item.key() << "=";
        if (item.value().is_string()) out << item.value().get<std::string>();
        else if (item.value().is_number_integer()) out << item.value().get<int>();
        else if (item.value().is_boolean()) out << (item.value().get<bool>() ? "true" : "false");
        else out << item.value().dump();
    }
    return out.str();
}

std::optional<int> ReadOptionalInt(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    return found != value.end() && found->is_number_integer()
        ? std::optional<int>(found->get<int>())
        : std::nullopt;
}

std::string BuildActionLabel(const domain::GameAction& action)
{
    const auto details = CompactPayloadLabel(action.payload);
    if (!action.label.empty()) return details.empty() ? action.label : action.label + " (" + details + ")";
    return details.empty() ? action.type : action.type + " " + details;
}
}

std::vector<std::string> DecodeLog(const nlohmann::json& payload)
{
    std::vector<std::string> result;
    const auto log = payload.find("log");
    if (log == payload.end() || !log->is_array()) return result;
    for (const auto& entry : *log)
    {
        if (entry.is_string()) result.push_back(entry.get<std::string>());
        else if (entry.is_object())
        {
            auto message = ReadString(entry, "message");
            if (!message.empty()) result.push_back(std::move(message));
        }
    }
    return result;
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

std::vector<domain::GameShortcut> DecodeShortcuts(const nlohmann::json& extras)
{
    std::vector<domain::GameShortcut> result;
    const auto shortcuts = extras.find("shortcuts");
    if (shortcuts == extras.end() || !shortcuts->is_array()) return result;
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
        field.minimum = ReadOptionalInt(raw, "min");
        field.maximum = ReadOptionalInt(raw, "max");
        if (field.label.empty()) field.label = field.key;
        if (!field.key.empty()) prompt.fields.push_back(std::move(field));
    }
    return prompt.fields.empty() ? std::nullopt : std::optional<domain::GamePrompt>(std::move(prompt));
}

std::vector<domain::GameLine> BuildLines(const std::vector<domain::GameAction>& actions)
{
    std::vector<domain::GameLine> lines;
    lines.reserve(actions.size());
    for (std::size_t index = 0; index < actions.size(); ++index)
    {
        const auto& action = actions[index];
        domain::GameLine line;
        line.id = action.type + "#" + std::to_string(index);
        line.label = BuildActionLabel(action);
        line.detail = CompactPayloadLabel(action.payload);
        line.kind = domain::GameLineKind::Action;
        line.actionIndex = index;
        line.enabled = !action.disabled;
        line.raw = nlohmann::json{{"type", action.type}, {"payload", action.payload}};
        lines.push_back(std::move(line));
    }
    return lines;
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
