#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"

#include "modules/gameplay/session/domain/GameProtocolException.h"

#include <algorithm>
#include <stdexcept>
#include <utility>

#include "modules/gameplay/cards/infrastructure/GameCardDecoder.h"
#include "modules/gameplay/dice/infrastructure/GameDiceDecoder.h"
#include "modules/gameplay/actions/infrastructure/GameActionCatalogDecoder.h"
#include "modules/gameplay/state/infrastructure/GameAssetCapabilitiesDecoder.h"
#include "modules/gameplay/state/infrastructure/GameBoardCapabilitiesDecoder.h"
#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GamePendingDecoder.h"
#include "modules/gameplay/state/infrastructure/GamePlayerValuesDecoder.h"
#include "modules/gameplay/state/infrastructure/GameStateSectionsDecoder.h"
#include "modules/gameplay/state/infrastructure/GameSystemDecoder.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "modules/gameplay/state/infrastructure/GameWorkflowCapabilitiesDecoder.h"
#include "modules/gameplay/state/domain/GameCapabilityId.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
const nlohmann::json& RequiredObject(const nlohmann::json& payload, const char* key)
{
    const auto found = payload.find(key);
    if (found == payload.end() || !found->is_object())
        throw std::runtime_error(std::string("Section V2 invalide: ") + key + ".");
    return *found;
}

const nlohmann::json* OptionalObject(const nlohmann::json& payload, const char* key)
{
    const auto found = payload.find(key);
    if (found == payload.end() || found->is_null()) return nullptr;
    if (!found->is_object())
        throw std::runtime_error(std::string("Capability V2 invalide: ") + key + ".");
    return &*found;
}

void DecodeKits(const nlohmann::json& raw, domain::GameKits& kits)
{
    for (const auto& item : raw.items())
        if (!item.value().is_null()) kits.availableCapabilities.insert(item.key());
    if (const auto* value = OptionalObject(raw, "cards"))
        kits.cards = GameCardDecoder::Decode(*value);
    if (const auto* value = OptionalObject(raw, "dice"))
        kits.dice = GameDiceDecoder::Decode(*value);
    if (const auto* value = OptionalObject(raw, "grid"))
        kits.grid = GameBoardCapabilitiesDecoder::Grid(*value);
    if (const auto* value = OptionalObject(raw, "movement"))
        kits.movement = GameBoardCapabilitiesDecoder::Movement(*value);
    if (const auto* value = OptionalObject(raw, "pawns"))
        kits.pawns = GameBoardCapabilitiesDecoder::Pawns(*value);
    if (const auto* value = OptionalObject(raw, "score"))
        kits.score = GamePlayerValuesDecoder::Score(*value);
    if (const auto* value = OptionalObject(raw, "resources"))
        kits.resources = GamePlayerValuesDecoder::Resources(*value);
    if (const auto* value = OptionalObject(raw, "counters"))
        kits.counters = GamePlayerValuesDecoder::Counters(*value);
    if (const auto* value = OptionalObject(raw, "status"))
        kits.status = GamePlayerValuesDecoder::Status(*value);
    if (const auto* value = OptionalObject(raw, "inventory"))
        kits.inventory = GameAssetCapabilitiesDecoder::Inventory(*value);
    if (const auto* value = OptionalObject(raw, "economy"))
        kits.economy = GameAssetCapabilitiesDecoder::Economy(*value);
    if (const auto* value = OptionalObject(raw, "ownership"))
        kits.ownership = GameAssetCapabilitiesDecoder::Ownership(*value);
    if (const auto* value = OptionalObject(raw, "collections"))
        kits.collections = GameAssetCapabilitiesDecoder::Collections(*value);
    if (const auto* value = OptionalObject(raw, "quiz"))
        kits.quiz = GameWorkflowCapabilitiesDecoder::Quiz(*value);
    if (const auto* value = OptionalObject(raw, "submissions"))
        kits.submissions = GameWorkflowCapabilitiesDecoder::Submissions(*value);
    for (const auto& item : raw.items())
        if (std::find(domain::capability::Known.begin(),
                domain::capability::Known.end(), item.key()) ==
                domain::capability::Known.end() &&
            !item.value().is_null())
            kits.unknownCapabilities.emplace(item.key(), DecodeGameValue(item.value()));
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
    state.roomId = ReadRequiredInt(payload, "roomId");
    state.viewerPlayerId = ReadOptionalInt(payload, "viewerPlayerId");
    if (state.viewerPlayerId && *state.viewerPlayerId <= 0)
        throw std::runtime_error("Identifiant viewer gameplay invalide.");
    state.runId = ReadRequiredInt(payload, "runId");
    state.version = ReadRequiredInt(payload, "version");
    state.viewVersion = ReadRequiredInt(payload, "viewVersion");
    if (state.viewVersion != domain::GameState::SupportedViewVersion)
        throw domain::GameProtocolException(
            "Version de vue de jeu non supportee: " + std::to_string(state.viewVersion) + ".");
    const auto& system = RequiredObject(payload, "system");
    const auto& kits = RequiredObject(payload, "kits");
    state.system = GameSystemDecoder::Decode(system);
    DecodeKits(kits, state.kits);
    if (const auto* effect = OptionalObject(payload, "effect"))
        state.effect = GameWorkflowCapabilitiesDecoder::Effect(*effect);
    if (const auto* game = OptionalObject(payload, "game"))
        state.game = DecodeGameValue(*game);
    state.actionCatalog = GameActionCatalogDecoder::Decode(
        payload.value("actionCatalog", nlohmann::json::array()));
    if (const auto* timers = OptionalObject(payload, "timers"))
        state.timers = GameWorkflowCapabilitiesDecoder::Timers(*timers);
    state.actions = DecodeActions(payload);
    ApplyCatalogLabels(state.actions, state.actionCatalog);
    state.system.shortcuts = DecodeShortcuts(system);
    const auto pending = payload.find("pending");
    if (pending != payload.end() && pending->is_object())
    {
        state.pending = GamePendingDecoder::Decode(*pending, state.actions);
        if (state.pending) state.pending->prompt = DecodePrompt(payload);
    }
    state.gameType = ReadRequiredString(payload, "gameType");
    if (state.gameType.empty() || state.gameType.size() > 128)
        throw std::runtime_error("Identite de jeu invalide.");
    if (state.roomId <= 0) throw std::runtime_error("Etat de jeu sans table.");
    return state;
}

std::string GameStatePayloadCodec::NormalizeShortcutKey(std::string rawKey)
{
    return detail::NormalizeShortcutKey(std::move(rawKey));
}
}
