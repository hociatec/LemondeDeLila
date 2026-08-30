#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"

#include <stdexcept>
#include <utility>

#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"
#include "modules/gameplay/dice/infrastructure/GameDiceDecoder.h"
#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"
#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GamePendingDecoder.h"
#include "modules/gameplay/state/infrastructure/GameStateSectionsDecoder.h"
#include "modules/gameplay/state/infrastructure/GameSystemDecoder.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
nlohmann::json Section(const nlohmann::json& payload, const char* key)
{
    const auto found = payload.find(key);
    return found != payload.end() && found->is_object()
        ? *found : nlohmann::json::object();
}

void DecodeKits(const nlohmann::json& raw, domain::GameKits& kits)
{
    kits.cards = Section(raw, "cards");
    kits.dice = Section(raw, "dice");
    kits.grid = Section(raw, "grid");
    kits.movement = Section(raw, "movement");
    kits.pawns = Section(raw, "pawns");
    kits.score = Section(raw, "score");
    kits.resources = Section(raw, "resources");
    kits.counters = Section(raw, "counters");
    kits.status = Section(raw, "status");
    kits.inventory = Section(raw, "inventory");
    kits.economy = Section(raw, "economy");
    kits.ownership = Section(raw, "ownership");
    kits.collections = Section(raw, "collections");
    kits.quiz = Section(raw, "quiz");
    kits.submissions = Section(raw, "submissions");
}

std::string PlayerName(const domain::GameSystem& system, int playerId)
{
    for (const auto& player : system.players)
        if (player.id == playerId) return player.username;
    return {};
}

std::vector<std::string> EventMessages(const domain::GameSystem& system)
{
    std::vector<std::string> messages;
    messages.reserve(system.events.size());
    for (const auto& event : system.events)
    {
        std::string message = event.type;
        const auto explicitMessage = event.data.find("message");
        if (explicitMessage != event.data.end() && explicitMessage->is_string())
            message = explicitMessage->get<std::string>();
        else if (!event.data.empty()) message += " : " + event.data.dump();
        messages.push_back(std::to_string(event.occurredAtMs) + "|" + message);
    }
    return messages;
}

void ApplyCatalogLabels(
    std::vector<domain::GameAction>& actions,
    const nlohmann::json& catalog)
{
    if (!catalog.is_array()) return;
    for (auto& action : actions)
        for (const auto& descriptor : catalog)
        {
            if (!descriptor.is_object() ||
                detail::ReadString(descriptor, "type") != action.type) continue;
            const auto ui = Section(descriptor, "ui");
            if (action.label.empty()) action.label = detail::ReadString(ui, "label");
            action.documentation = detail::ReadString(descriptor, "documentation");
            break;
        }
}
}

domain::GameState GameStatePayloadCodec::DecodeState(const nlohmann::json& payload)
{
    using namespace detail;
    if (!payload.is_object()) throw std::runtime_error("Etat de jeu invalide.");
    domain::GameState state;
    state.roomId = ReadInt(payload, "roomId");
    state.version = ReadInt(payload, "version");
    state.viewVersion = ReadInt(payload, "viewVersion");
    if (state.viewVersion != domain::GameState::SupportedViewVersion)
        throw std::runtime_error(
            "Version de vue de jeu non supportee: " + std::to_string(state.viewVersion) + ".");
    const auto system = Section(payload, "system");
    const auto kits = Section(payload, "kits");
    if (system.empty() || kits.empty())
        throw std::runtime_error("Projection de jeu V2 incomplete.");
    state.system = GameSystemDecoder::Decode(system);
    DecodeKits(kits, state.kits);
    state.effect = Section(payload, "effect");
    state.game = Section(payload, "game");
    state.actionCatalog = payload.value("actionCatalog", nlohmann::json::array());
    if (!state.actionCatalog.is_array()) state.actionCatalog = nlohmann::json::array();
    state.timers = Section(payload, "timers");
    state.actions = DecodeActions(payload);
    ApplyCatalogLabels(state.actions, state.actionCatalog);
    state.shortcuts = DecodeShortcuts(system);
    state.hand = GameCardDecoder::DecodeVisibleHands(state.kits.cards);
    state.dice = GameDiceDecoder::Decode(state.kits.dice);
    const auto pending = payload.find("pending");
    if (pending != payload.end() && pending->is_object())
        state.pending = GamePendingDecoder::Decode(*pending, state.actions);
    state.prompt = DecodePrompt(payload);
    state.pawnSelection = PawnSelectionDecoder::Decode(payload, state.actions, state.kits.pawns);
    state.lines = BuildLines(state.actions);
    state.logMessages = EventMessages(state.system);
    state.round = state.system.round.number;
    state.turnIndex = state.system.turn.number;
    state.status = state.system.match.status;
    state.phase = state.system.setup.phase;
    if (state.system.turn.currentPlayerId)
        state.currentPlayerLabel = PlayerName(state.system, *state.system.turn.currentPlayerId);
    state.turnLabel = state.currentPlayerLabel.empty()
        ? std::string("Aucun tour actif") : "Tour de " + state.currentPlayerLabel;
    state.gameType = ReadString(payload, "gameType");
    state.gameName = ReadString(payload, "gameName");
    if (state.roomId <= 0) throw std::runtime_error("Etat de jeu sans table.");
    return state;
}

nlohmann::json GameStatePayloadCodec::EncodeActionPayload(
    int roomId,
    const std::string& gameType,
    const domain::GameAction& action)
{
    return {{"roomId", roomId}, {"gameType", gameType},
        {"actions", nlohmann::json::array({{{"type", action.type}, {"payload", action.payload}}})}};
}

std::string GameStatePayloadCodec::NormalizeShortcutKey(std::string rawKey)
{
    return detail::NormalizeShortcutKey(std::move(rawKey));
}
}
