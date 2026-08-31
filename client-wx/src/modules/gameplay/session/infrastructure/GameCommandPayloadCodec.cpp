#include "modules/gameplay/session/infrastructure/GameCommandPayloadCodec.h"

#include <algorithm>
#include <stdexcept>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

namespace lila::modules::gameplay::infrastructure
{
nlohmann::json GameCommandPayloadCodec::EncodeAction(
    const domain::GameCommandEnvelope& command)
{
    if (command.roomId <= 0 || command.gameType.empty() ||
        command.commandId.empty() || command.knownVersion < 0 ||
        command.actions.empty())
        throw std::invalid_argument("Enveloppe de commande de jeu invalide.");

    auto actions = nlohmann::json::array();
    for (const auto& action : command.actions)
    {
        if (action.type.empty())
            throw std::invalid_argument("Action de jeu invalide.");
        actions.push_back({{"type", action.type}, {"payload", action.payload}});
    }
    return {{"roomId", command.roomId}, {"gameType", command.gameType},
        {"commandId", command.commandId}, {"knownVersion", command.knownVersion},
        {"actions", std::move(actions)}};
}

nlohmann::json GameCommandPayloadCodec::EncodeCandidatesRequest(
    int roomId,
    const std::string& gameType,
    const domain::GameActionCandidatesRequest& request)
{
    if (roomId <= 0 || gameType.empty() || request.actionType.empty())
        throw std::invalid_argument("Requête de candidats de jeu invalide.");
    domain::GameValue queryValue{request.query};
    return {{"roomId", roomId}, {"gameType", gameType},
        {"actionType", request.actionType}, {"query", EncodeGameValue(queryValue)},
        {"offset", std::max(0, request.offset)},
        {"limit", std::clamp(request.limit, 1, 200)}};
}

domain::GameActionCandidatesResult GameCommandPayloadCodec::DecodeCandidates(
    const nlohmann::json& payload)
{
    if (!payload.is_object())
        throw std::runtime_error("Réponse de candidats de jeu invalide.");
    domain::GameActionCandidatesResult result;
    result.roomId = detail::ReadInt(payload, "roomId");
    result.gameType = detail::ReadString(payload, "gameType");
    result.actionType = detail::ReadString(payload, "actionType");
    result.offset = std::max(0, detail::ReadInt(payload, "offset"));
    result.limit = std::clamp(detail::ReadInt(payload, "limit"), 1, 200);
    const auto nextOffset = payload.find("nextOffset");
    if (nextOffset != payload.end() && nextOffset->is_number_integer() &&
        nextOffset->get<int>() >= 0)
        result.nextOffset = nextOffset->get<int>();
    const auto items = payload.find("items");
    if (items == payload.end() || !items->is_array())
        throw std::runtime_error("Liste de candidats de jeu absente.");
    for (const auto& item : *items)
    {
        if (!item.is_object()) continue;
        domain::GameAction action;
        action.type = detail::ReadString(item, "type");
        const auto actionPayload = item.find("payload");
        if (actionPayload != item.end() && actionPayload->is_object())
            action.payload = *actionPayload;
        if (!action.type.empty()) result.items.push_back(std::move(action));
    }
    if (result.roomId <= 0 || result.gameType.empty() || result.actionType.empty())
        throw std::runtime_error("Identité de candidats de jeu invalide.");
    return result;
}
}
