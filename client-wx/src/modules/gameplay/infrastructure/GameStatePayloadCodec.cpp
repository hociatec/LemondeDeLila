#include "modules/gameplay/infrastructure/GameStatePayloadCodec.h"

#include <algorithm>
#include <cctype>
#include <sstream>
#include <stdexcept>
#include <utility>

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::string Trim(std::string value)
{
    const auto notSpace = [](unsigned char ch) { return std::isspace(ch) == 0; };
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), notSpace));
    value.erase(std::find_if(value.rbegin(), value.rend(), notSpace).base(), value.end());
    return value;
}

std::string ToUpper(std::string value)
{
    std::transform(value.begin(), value.end(), value.begin(),
        [](unsigned char ch) { return static_cast<char>(std::toupper(ch)); });
    return value;
}

std::string ReadString(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    return found != value.end() && found->is_string() ? found->get<std::string>() : std::string{};
}

int ReadInt(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    if (found == value.end()) return 0;
    if (found->is_number_integer()) return found->get<int>();
    if (found->is_string())
    {
        try
        {
            return std::stoi(found->get<std::string>());
        }
        catch (...)
        {
            return 0;
        }
    }
    return 0;
}

bool ReadBool(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    if (found == value.end()) return false;
    if (found->is_boolean()) return found->get<bool>();
    if (found->is_number_integer()) return found->get<int>() != 0;
    if (found->is_string())
    {
        const auto raw = ToUpper(Trim(found->get<std::string>()));
        return raw == "TRUE" || raw == "1" || raw == "YES" || raw == "OUI" || raw == "ON";
    }
    return false;
}

std::string ReadPlayerUsername(const nlohmann::json& stateNode, int playerId)
{
    if (playerId <= 0) return {};
    const auto players = stateNode.find("players");
    if (players == stateNode.end() || !players->is_array()) return {};
    for (const auto& player : *players)
    {
        if (!player.is_object()) continue;
        if (ReadInt(player, "id") == playerId) return ReadString(player, "username");
    }
    return {};
}

nlohmann::json ObjectOrEmpty(const nlohmann::json& value)
{
    return value.is_object() ? value : nlohmann::json::object();
}

const nlohmann::json& EffectiveStateNode(const nlohmann::json& payload)
{
    const auto state = payload.find("state");
    return state != payload.end() && state->is_object() ? *state : payload;
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

std::vector<std::string> DecodeLog(const nlohmann::json& payload)
{
    std::vector<std::string> result;
    const auto log = payload.find("log");
    if (log == payload.end() || !log->is_array()) return result;
    for (const auto& entry : *log)
    {
        if (entry.is_string())
        {
            result.push_back(entry.get<std::string>());
        }
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

    for (const auto& rawAction : *actions)
    {
        if (!rawAction.is_object()) continue;
        domain::GameAction action;
        action.type = ReadString(rawAction, "type");
        action.label = ReadString(rawAction, "label");
        action.payload = ObjectOrEmpty(rawAction.value("payload", nlohmann::json::object()));
        action.disabled = ReadBool(rawAction, "disabled");
        action.confirm = ReadBool(rawAction, "confirm");
        if (!action.type.empty()) result.push_back(std::move(action));
    }
    return result;
}

domain::GameShortcut DecodeShortcut(const nlohmann::json& raw)
{
    domain::GameShortcut shortcut;
    shortcut.rawKey = ReadString(raw, "key");
    shortcut.normalizedKey = GameStatePayloadCodec::NormalizeShortcutKey(shortcut.rawKey);
    const auto type = ToUpper(Trim(ReadString(raw, "type")));
    if (type == "INTERFACE") shortcut.kind = domain::GameShortcutKind::Interface;
    else if (type == "ACTION") shortcut.kind = domain::GameShortcutKind::Action;
    shortcut.id = ReadString(raw, "id");
    shortcut.actionType = ReadString(raw, "actionType");
    return shortcut;
}

std::vector<domain::GameShortcut> DecodeShortcuts(const nlohmann::json& extras)
{
    std::vector<domain::GameShortcut> result;
    const auto shortcuts = extras.find("shortcuts");
    if (shortcuts == extras.end() || !shortcuts->is_array()) return result;
    for (const auto& raw : *shortcuts)
    {
        if (!raw.is_object()) continue;
        auto shortcut = DecodeShortcut(raw);
        if (!shortcut.normalizedKey.empty() && shortcut.kind != domain::GameShortcutKind::Unknown)
            result.push_back(std::move(shortcut));
    }
    return result;
}

std::string BuildActionLabel(const domain::GameAction& action)
{
    if (!action.label.empty()) return action.label;
    const auto details = CompactPayloadLabel(action.payload);
    return details.empty() ? action.type : action.type + " " + details;
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
}

domain::GameState GameStatePayloadCodec::DecodeState(const nlohmann::json& payload)
{
    if (!payload.is_object()) throw std::runtime_error("Etat de jeu invalide.");
    const auto& stateNode = EffectiveStateNode(payload);

    domain::GameState state;
    state.raw = payload;
    state.roomId = ReadInt(payload, "roomId");
    if (state.roomId <= 0) state.roomId = ReadInt(stateNode, "roomId");
    state.version = ReadInt(payload, "version");
    if (state.version <= 0) state.version = ReadInt(stateNode, "version");
    state.gameType = ReadString(payload, "gameType");
    if (state.gameType.empty()) state.gameType = ReadString(stateNode, "gameType");
    state.gameName = ReadString(payload, "gameName");
    state.status = ReadString(stateNode, "status");
    state.phase = ReadString(stateNode, "phase");
    state.turnLabel = ReadString(stateNode, "turnLabel");
    if (state.turnLabel.empty()) state.turnLabel = ReadString(payload, "turnLabel");
    state.currentPlayerLabel = ReadString(stateNode, "currentPlayerUsername");
    const auto turn = stateNode.find("turn");
    if (turn != stateNode.end() && turn->is_object())
    {
        if (state.turnLabel.empty()) state.turnLabel = ReadString(*turn, "label");
        if (state.currentPlayerLabel.empty())
            state.currentPlayerLabel = ReadPlayerUsername(stateNode, ReadInt(*turn, "currentPlayerId"));
    }
    state.metadata = ObjectOrEmpty(stateNode.value("metadata", payload.value("metadata", nlohmann::json::object())));
    state.extras = ObjectOrEmpty(stateNode.value("extras", payload.value("extras", nlohmann::json::object())));
    state.actions = DecodeActions(stateNode);
    if (state.actions.empty()) state.actions = DecodeActions(payload);
    state.shortcuts = DecodeShortcuts(state.extras);
    state.logMessages = DecodeLog(stateNode);
    if (state.logMessages.empty()) state.logMessages = DecodeLog(payload);
    state.lines = BuildLines(state.actions);

    const auto currentPlayerView = state.extras.find("currentPlayerView");
    if (currentPlayerView != state.extras.end() && currentPlayerView->is_object())
    {
        const auto username = ReadString(*currentPlayerView, "username");
        if (!username.empty()) state.currentPlayerLabel = username;
    }

    if (state.roomId <= 0) throw std::runtime_error("Etat de jeu sans table.");
    if (state.gameType.empty()) throw std::runtime_error("Etat de jeu sans type.");
    return state;
}

nlohmann::json GameStatePayloadCodec::EncodeActionPayload(
    int roomId,
    const std::string& gameType,
    const domain::GameAction& action)
{
    return {
        {"roomId", roomId},
        {"gameType", gameType},
        {"actions", nlohmann::json::array({
            {{"type", action.type}, {"payload", action.payload}}
        })},
    };
}

std::string GameStatePayloadCodec::NormalizeShortcutKey(std::string rawKey)
{
    rawKey = Trim(std::move(rawKey));
    constexpr char Prefix[] = "pressed ";
    if (rawKey.size() >= sizeof(Prefix) - 1)
    {
        const auto head = ToUpper(rawKey.substr(0, sizeof(Prefix) - 1));
        if (head == "PRESSED ") rawKey = Trim(rawKey.substr(sizeof(Prefix) - 1));
    }
    rawKey = ToUpper(rawKey);
    if (rawKey == "RETURN") return "ENTER";
    if (rawKey == "BACKSPACE") return "BACK";
    return rawKey;
}
}
