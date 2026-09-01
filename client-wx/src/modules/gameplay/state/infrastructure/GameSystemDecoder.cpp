#include "modules/gameplay/state/infrastructure/GameSystemDecoder.h"

#include <algorithm>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"
#include "shared/data/json/JsonCoercion.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::optional<int> OptionalInt(const nlohmann::json& value, const char* key)
{
    return lila::shared::data::json::ReadOptionalIntegerCoerced(value, key);
}

std::optional<std::int64_t> OptionalInt64(const nlohmann::json& value, const char* key)
{
    const auto found = value.find(key);
    if (found == value.end() || found->is_null() || !found->is_number_integer())
        return std::nullopt;
    return found->get<std::int64_t>();
}

std::string EventText(const nlohmann::json& data, const char* key)
{
    const auto found = data.find(key);
    if (found == data.end()) return {};
    if (found->is_string()) return found->get<std::string>();
    if (found->is_number_integer()) return std::to_string(found->get<long long>());
    if (found->is_number_float()) return std::to_string(found->get<double>());
    return {};
}

std::string EventContent(const nlohmann::json& data, const char* key)
{
    const auto found = data.find(key);
    if (found == data.end()) return {};
    if (found->is_string() || found->is_number()) return EventText(data, key);
    if (!found->is_object()) return {};
    for (const auto* labelKey : {"label", "name", "title", "id", "cardId", "itemId"})
        if (const auto value = EventText(*found, labelKey); !value.empty()) return value;
    return {};
}

domain::GameEngineEventData DecodeEventData(
    const std::string& eventType, const nlohmann::json& data)
{
    domain::GameEngineEventData result;
    result.message = EventText(data, "message");
    result.content = EventContent(data, "card");
    result.deckId = EventText(data, "deckId");
    result.resourceId = EventText(data, "resource");
    result.itemId = EventText(data, "itemId");
    result.pawnId = EventText(data, "pawnId");
    result.total = EventText(data, "total");
    result.value = EventText(data, "value");
    result.amount = EventText(data, "amount");
    result.fromPosition = EventText(data, "from");
    result.toPosition = EventText(data, "to");
    result.position = EventText(data, "position");
    result.number = EventText(data, "number");
    result.count = EventText(data, "count");
    result.playerId = OptionalInt(data, "playerId");
    if (eventType == "resource.transferred")
    {
        result.sourcePlayerId = OptionalInt(data, "from");
        result.targetPlayerId = OptionalInt(data, "to");
    }
    else
    {
        result.sourcePlayerId = OptionalInt(data, "fromPlayerId");
        result.targetPlayerId = OptionalInt(data, "toPlayerId");
    }
    result.leftPlayerId = OptionalInt(data, "leftPlayerId");
    result.rightPlayerId = OptionalInt(data, "rightPlayerId");
    return result;
}

std::vector<int> IntArray(const nlohmann::json& object, const char* key)
{
    std::vector<int> result;
    const auto values = object.find(key);
    if (values == object.end() || !values->is_array()) return result;
    for (const auto& value : *values)
        if (value.is_number_integer()) result.push_back(value.get<int>());
    return result;
}

std::unordered_map<int, int> IntMap(const nlohmann::json& object, const char* key)
{
    std::unordered_map<int, int> result;
    const auto values = object.find(key);
    if (values == object.end() || !values->is_object()) return result;
    for (const auto& item : values->items())
    {
        try
        {
            if (item.value().is_number_integer())
                result.emplace(std::stoi(item.key()), item.value().get<int>());
        }
        catch (const std::exception&) {}
    }
    return result;
}

void DecodeMatch(const nlohmann::json& raw, domain::GameMatch& match)
{
    match.status = detail::ReadString(raw, "status");
    match.startedAtMs = OptionalInt64(raw, "startedAtMs");
    match.finishedAtMs = OptionalInt64(raw, "finishedAtMs");
    const auto result = raw.find("result");
    if (result != raw.end() && result->is_object())
    {
        domain::GameMatchResult decoded;
        decoded.winnerPlayerIds = IntArray(*result, "winnerPlayerIds");
        decoded.reason = detail::ReadString(*result, "reason");
        const auto ranking = result->find("ranking");
        if (ranking != result->end() && ranking->is_array())
            for (const auto& rank : *ranking)
                if (rank.is_array()) decoded.ranking.push_back(IntArray({{"rank", rank}}, "rank"));
        match.result = std::move(decoded);
    }
    const auto statuses = raw.find("playerStatuses");
    if (statuses != raw.end() && statuses->is_object())
        for (const auto& item : statuses->items())
            try { if (item.value().is_string()) match.playerStatuses.emplace(
                std::stoi(item.key()), item.value().get<std::string>()); }
            catch (const std::exception&) {}
}

void DecodeRound(const nlohmann::json& raw, domain::GameRound& round)
{
    round.number = detail::ReadInt(raw, "number");
    round.status = detail::ReadString(raw, "status");
    round.starterPlayerId = OptionalInt(raw, "starterPlayerId");
    round.participantPlayerIds = IntArray(raw, "participantPlayerIds");
    round.leftPlayerIds = IntArray(raw, "leftPlayerIds");
    round.winnerPlayerIds = IntArray(raw, "winnerPlayerIds");
    round.completedRounds = detail::ReadInt(raw, "completedRounds");
}

void DecodeTurn(const nlohmann::json& raw, domain::GameTurn& turn)
{
    turn.currentPlayerId = OptionalInt(raw, "currentPlayerId");
    turn.direction = detail::ReadInt(raw, "direction");
    if (turn.direction != -1) turn.direction = 1;
    turn.number = detail::ReadInt(raw, "number");
    turn.actionPointsRemaining = OptionalInt(raw, "actionPointsRemaining");
    turn.immediateExtraTurns = detail::ReadInt(raw, "immediateExtraTurns");
    turn.extraCount = detail::ReadInt(raw, "extraCount");
    turn.skipTurnsByPlayer = IntMap(raw, "skipTurnsByPlayer");
    turn.extraTurnsByPlayer = IntMap(raw, "extraTurnsByPlayer");
    turn.replacementTurnsByPlayer = IntMap(raw, "replacementTurnsByPlayer");
    turn.waitingSessionId = detail::ReadString(raw, "waitingSessionId");
    turn.waitingPlayerIds = IntArray(raw, "waitingPlayerIds");
}

void DecodePlayers(const nlohmann::json& raw, std::vector<domain::GamePlayer>& players)
{
    const auto all = raw.find("all");
    if (all == raw.end() || !all->is_array()) return;
    for (const auto& item : *all)
    {
        if (!item.is_object()) continue;
        domain::GamePlayer player;
        player.id = detail::ReadInt(item, "id");
        player.username = detail::ReadString(item, "username");
        player.isBot = detail::ReadBool(item, "isBot");
        player.alive = !item.contains("alive") || detail::ReadBool(item, "alive");
        if (player.id != 0) players.push_back(std::move(player));
    }
}
}

domain::GameSystem GameSystemDecoder::Decode(const nlohmann::json& system)
{
    domain::GameSystem result;
    if (!system.is_object()) return result;
    DecodeMatch(detail::ObjectOrEmpty(system.value("match", nlohmann::json::object())), result.match);
    DecodeRound(detail::ObjectOrEmpty(system.value("round", nlohmann::json::object())), result.round);
    DecodeTurn(detail::ObjectOrEmpty(system.value("turn", nlohmann::json::object())), result.turn);
    DecodePlayers(detail::ObjectOrEmpty(system.value("players", nlohmann::json::object())), result.players);
    const auto setup = detail::ObjectOrEmpty(system.value("setup", nlohmann::json::object()));
    result.setup.complete = detail::ReadBool(setup, "complete");
    result.setup.phase = detail::ReadString(setup, "phase");
    result.setup.ownerPlayerId = OptionalInt(setup, "ownerPlayerId");
    const auto setupValues = setup.find("values");
    if (setupValues != setup.end() && setupValues->is_object())
        for (const auto& item : setupValues->items())
            result.setup.values.emplace(item.key(), DecodeGameValue(item.value()));
    const auto events = detail::ObjectOrEmpty(system.value("events", nlohmann::json::object()));
    const auto decodeEvent = [&result](const nlohmann::json& raw)
    {
        if (!raw.is_object()) return;
        domain::GameEngineEvent event;
        event.id = detail::ReadString(raw, "id");
        event.type = detail::ReadString(raw, "type");
        const auto occurredAtMs = OptionalInt64(raw, "occurredAtMs");
        if (event.id.empty() || event.type.empty() || !occurredAtMs) return;
        event.details = DecodeEventData(event.type, detail::ObjectOrEmpty(
            raw.value("data", nlohmann::json::object())));
        event.actorId = OptionalInt(raw, "actorId");
        event.occurredAtMs = *occurredAtMs;
        event.sequence = OptionalInt64(raw, "sequence");
        result.events.push_back(std::move(event));
    };
    const auto recent = events.find("recent");
    if (recent != events.end() && recent->is_array())
    {
        for (const auto& raw : *recent) decodeEvent(raw);
    }
    else
    {
        const auto latest = events.find("latestByType");
        if (latest != events.end() && latest->is_object())
            for (const auto& item : latest->items()) decodeEvent(item.value());
    }
    std::sort(result.events.begin(), result.events.end(), [](const auto& left, const auto& right)
        {
            if (left.sequence && right.sequence) return *left.sequence < *right.sequence;
            return left.occurredAtMs < right.occurredAtMs;
        });
    return result;
}
}
