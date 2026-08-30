#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"

#include <algorithm>
#include <stdexcept>
#include <utility>

#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"
#include "modules/gameplay/dice/infrastructure/GameDiceDecoder.h"
#include "modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.h"
#include "modules/gameplay/events/presentation/GameEventPresenter.h"
#include "modules/gameplay/pawn_selection/infrastructure/PawnSelectionDecoder.h"
#include "modules/gameplay/state/infrastructure/GameAssetCapabilitiesDecoder.h"
#include "modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.h"
#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GamePendingDecoder.h"
#include "modules/gameplay/state/infrastructure/GamePlayerValuesDecoder.h"
#include "modules/gameplay/state/infrastructure/GameStateSectionsDecoder.h"
#include "modules/gameplay/state/infrastructure/GameSystemDecoder.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "modules/gameplay/state/infrastructure/GameWorkflowCapabilitiesDecoder.h"

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
    const auto cards = Section(raw, "cards");
    if (!cards.empty())
    {
        domain::GameCardsView view;
        view.visibleHand = GameCardDecoder::DecodeVisibleHands(cards);
        view.decks = DecodeGameValue(cards.value("decks", nlohmann::json::object()));
        view.discards = DecodeGameValue(cards.value("discards", nlohmann::json::object()));
        view.hands = DecodeGameValue(cards.value("hands", nlohmann::json::object()));
        view.zones = DecodeGameValue(cards.value("zones", nlohmann::json::object()));
        kits.cards = std::move(view);
    }
    const auto dice = Section(raw, "dice");
    if (!dice.empty()) kits.dice = GameDiceDecoder::Decode(dice);
    kits.grid = GameBoardCapabilitiesDecoder::Grid(Section(raw, "grid"));
    kits.movement = GameBoardCapabilitiesDecoder::Movement(Section(raw, "movement"));
    kits.pawns = GameBoardCapabilitiesDecoder::Pawns(Section(raw, "pawns"));
    kits.score = GamePlayerValuesDecoder::Score(Section(raw, "score"));
    kits.resources = GamePlayerValuesDecoder::Resources(Section(raw, "resources"));
    kits.counters = GamePlayerValuesDecoder::Counters(Section(raw, "counters"));
    kits.status = GamePlayerValuesDecoder::Status(Section(raw, "status"));
    kits.inventory = GameAssetCapabilitiesDecoder::Inventory(Section(raw, "inventory"));
    kits.economy = GameAssetCapabilitiesDecoder::Economy(Section(raw, "economy"));
    kits.ownership = GameAssetCapabilitiesDecoder::Ownership(Section(raw, "ownership"));
    kits.collections = GameAssetCapabilitiesDecoder::Collections(Section(raw, "collections"));
    kits.quiz = GameWorkflowCapabilitiesDecoder::Quiz(Section(raw, "quiz"));
    kits.submissions = GameWorkflowCapabilitiesDecoder::Submissions(Section(raw, "submissions"));
    static const std::vector<std::string> known{
        "cards", "dice", "grid", "movement", "pawns", "score", "resources",
        "counters", "status", "inventory", "economy", "ownership", "collections",
        "quiz", "submissions"};
    for (const auto& item : raw.items())
        if (std::find(known.begin(), known.end(), item.key()) == known.end())
            kits.unknownCapabilities.emplace(item.key(), DecodeGameValue(item.value()));
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
        const auto message = presentation::events::GameEventPresenter::Present(
            event, system.players);
        if (!message.empty()) messages.push_back(event.Identity() + "|" + message);
    }
    return messages;
}

void ApplyCatalogLabels(
    std::vector<domain::GameAction>& actions,
    const std::vector<domain::GameActionDescriptor>& catalog)
{
    for (auto& action : actions)
        for (const auto& descriptor : catalog)
        {
            if (descriptor.type != action.type) continue;
            if (action.label.empty()) action.label = descriptor.label;
            action.documentation = descriptor.documentation.empty()
                ? descriptor.description : descriptor.documentation;
            action.confirm = action.confirm || descriptor.confirm;
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
    state.effect = GameWorkflowCapabilitiesDecoder::Effect(Section(payload, "effect"));
    state.game = Section(payload, "game");
    state.actionCatalog = GameActionCatalogDecoder::Decode(
        payload.value("actionCatalog", nlohmann::json::array()));
    state.timers = GameWorkflowCapabilitiesDecoder::Timers(Section(payload, "timers"));
    state.actions = DecodeActions(payload);
    ApplyCatalogLabels(state.actions, state.actionCatalog);
    state.shortcuts = DecodeShortcuts(system);
    const auto pending = payload.find("pending");
    if (pending != payload.end() && pending->is_object())
        state.pending = GamePendingDecoder::Decode(*pending, state.actions);
    state.prompt = DecodePrompt(payload);
    state.pawnSelection = PawnSelectionDecoder::Decode(
        payload, state.actions, Section(kits, "pawns"));
    state.lines = BuildLines(state.actions);
    state.logMessages = EventMessages(state.system);
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
