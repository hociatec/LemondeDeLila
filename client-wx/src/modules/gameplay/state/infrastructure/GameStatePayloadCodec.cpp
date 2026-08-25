#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"

#include <stdexcept>
#include <utility>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameStateSectionsDecoder.h"
#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"
#include "modules/gameplay/dice/infrastructure/GameDiceDecoder.h"
#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"

namespace lila::modules::gameplay::infrastructure
{
domain::GameState GameStatePayloadCodec::DecodeState(const nlohmann::json& payload)
{
    using namespace detail;
    if (!payload.is_object()) throw std::runtime_error("Etat de jeu invalide.");
    const auto& stateNode = EffectiveStateNode(payload);

    domain::GameState state;
    state.raw = payload;
    state.roomId = ReadInt(payload, "roomId");
    if (state.roomId <= 0) state.roomId = ReadInt(stateNode, "roomId");
    state.version = ReadInt(payload, "version");
    if (state.version <= 0) state.version = ReadInt(stateNode, "version");
    state.turnIndex = ReadInt(stateNode, "turnIndex");
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
    state.hand = GameCardDecoder::DecodeHand(state.extras);
    state.dice = GameDiceDecoder::Decode(state.extras);
    state.actions = DecodeActions(stateNode);
    if (state.actions.empty()) state.actions = DecodeActions(payload);
    state.shortcuts = DecodeShortcuts(state.extras);
    state.logMessages = DecodeLog(stateNode);
    if (state.logMessages.empty()) state.logMessages = DecodeLog(payload);
    state.lines = BuildLines(state.actions);
    state.prompt = DecodePrompt(stateNode);
    const auto pending = stateNode.find("pending");
    const auto pendingType = pending != stateNode.end() && pending->is_object()
        ? ToUpper(Trim(ReadString(*pending, "type")))
        : std::string{};
    const auto phase = ToUpper(Trim(state.phase));
    if (state.prompt && pendingType == "CONFIG_PROMPT" &&
        (phase == "ROUND" || !state.hand.empty()))
    {
        state.prompt.reset();
    }
    state.pawnSelection = PawnSelectionDecoder::Decode(stateNode, state.actions);

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
    return detail::NormalizeShortcutKey(std::move(rawKey));
}
}
