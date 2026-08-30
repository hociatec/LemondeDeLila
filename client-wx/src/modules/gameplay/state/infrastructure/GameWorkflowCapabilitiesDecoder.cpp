#include "modules/gameplay/state/infrastructure/GameWorkflowCapabilitiesDecoder.h"

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GamePayloadJsonReader.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::vector<int> Ids(const nlohmann::json& object, const char* key)
{
    std::vector<int> result;
    const auto found = object.find(key);
    if (found == object.end() || !found->is_array()) return result;
    for (const auto& value : *found)
        if (value.is_number_integer()) result.push_back(value.get<int>());
    return result;
}

std::optional<int> OptionalInt(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    return found != object.end() && found->is_number_integer()
        ? std::optional<int>(found->get<int>()) : std::nullopt;
}

std::optional<std::int64_t> OptionalInt64(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    return found != object.end() && found->is_number_integer()
        ? std::optional<std::int64_t>(found->get<std::int64_t>()) : std::nullopt;
}

std::string PrimitiveId(const nlohmann::json& object, const char* key)
{
    const auto found = object.find(key);
    if (found == object.end()) return {};
    if (found->is_string()) return found->get<std::string>();
    if (found->is_number_integer()) return std::to_string(found->get<long long>());
    return {};
}

std::optional<domain::GameSubmissionValue> SubmissionValue(const nlohmann::json& raw)
{
    domain::GameSubmissionValue result;
    if (raw.is_string())
    {
        result.kind = domain::GameSubmissionValueKind::Text;
        result.text = raw.get<std::string>();
        return result;
    }
    if (raw.is_number())
    {
        result.kind = domain::GameSubmissionValueKind::Number;
        result.number = raw.get<double>();
        return result;
    }
    if (raw.is_boolean())
    {
        result.kind = domain::GameSubmissionValueKind::Boolean;
        result.boolean = raw.get<bool>();
        return result;
    }
    if (!raw.is_object()) return std::nullopt;
    result.label = detail::ReadString(raw, "label");
    result.text = detail::ReadString(raw, "text");
    if (result.text.empty()) result.text = detail::ReadString(raw, "value");
    if (const auto playerId = OptionalInt(raw, "playerId"))
    {
        result.kind = domain::GameSubmissionValueKind::Player;
        result.playerId = playerId;
        result.id = std::to_string(*playerId);
    }
    else if (!(result.id = PrimitiveId(raw, "cardId")).empty())
        result.kind = domain::GameSubmissionValueKind::Card;
    else if (!(result.id = PrimitiveId(raw, "optionId")).empty())
        result.kind = domain::GameSubmissionValueKind::Option;
    else if (!(result.id = PrimitiveId(raw, "id")).empty())
        result.kind = domain::GameSubmissionValueKind::Option;
    else if (!result.text.empty()) result.kind = domain::GameSubmissionValueKind::Text;
    return result.kind == domain::GameSubmissionValueKind::Unknown
        ? std::nullopt
        : std::optional<domain::GameSubmissionValue>(std::move(result));
}
}

std::optional<domain::GameQuizView> GameWorkflowCapabilitiesDecoder::Quiz(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameQuizView result;
    const auto banks = raw.find("banks");
    if (banks != raw.end() && banks->is_object())
        for (const auto& item : banks->items())
            if (item.value().is_object())
                result.banks.push_back({item.key(), detail::ReadInt(item.value(), "count"),
                    detail::ReadInt(item.value(), "cursor"),
                    detail::ReadInt(item.value(), "remaining")});
    const auto sessions = raw.find("sessions");
    if (sessions != raw.end() && sessions->is_object())
        for (const auto& item : sessions->items())
        {
            if (!item.value().is_object()) continue;
            domain::GameQuizSession session;
            session.id = detail::ReadString(item.value(), "id");
            if (session.id.empty()) session.id = item.key();
            session.bankId = detail::ReadString(item.value(), "bankId");
            session.phase = detail::ReadString(item.value(), "phase");
            session.scored = detail::ReadBool(item.value(), "scored");
            session.participantPlayerIds = Ids(item.value(), "participantPlayerIds");
            session.answeredPlayerIds = Ids(item.value(), "answeredPlayerIds");
            session.myAnswer = OptionalInt(item.value(), "myAnswer");
            session.correctAnswerIndex = OptionalInt(item.value(), "correctAnswerIndex");
            const auto question = item.value().find("question");
            if (question != item.value().end() && question->is_object())
            {
                session.prompt = detail::ReadString(*question, "prompt");
                const auto choices = question->find("choices");
                if (choices != question->end() && choices->is_array())
                    for (const auto& choice : *choices)
                        if (choice.is_string()) session.choices.push_back(choice.get<std::string>());
            }
            result.sessions.push_back(std::move(session));
        }
    return result.banks.empty() && result.sessions.empty()
        ? std::nullopt : std::optional<domain::GameQuizView>(std::move(result));
}

std::optional<domain::GameSubmissionsView> GameWorkflowCapabilitiesDecoder::Submissions(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameSubmissionsView result;
    result.stage = detail::ReadString(raw, "stage");
    const auto sessions = raw.find("sessions");
    if (sessions != raw.end() && sessions->is_object())
        for (const auto& item : sessions->items())
        {
            if (!item.value().is_object()) continue;
            domain::GameSubmissionSession session;
            session.id = item.key();
            session.kind = detail::ReadString(item.value(), "kind");
            session.participantPlayerIds = Ids(item.value(), "participantPlayerIds");
            session.submittedPlayerIds = Ids(item.value(), "submittedPlayerIds");
            session.pendingPlayerIds = Ids(item.value(), "pendingPlayerIds");
            session.closed = detail::ReadBool(item.value(), "closed");
            session.revealed = detail::ReadBool(item.value(), "revealed");
            const auto values = item.value().find("valuesByPlayerId");
            if (values != item.value().end() && values->is_object())
                for (const auto& value : values->items())
                    try
                    {
                        if (auto decoded = SubmissionValue(value.value()))
                            session.visibleValues.emplace(std::stoi(value.key()), std::move(*decoded));
                    }
                    catch (const std::exception&) {}
            const auto own = item.value().find("ownValue");
            if (own != item.value().end()) session.ownValue = SubmissionValue(*own);
            result.sessions.push_back(std::move(session));
        }
    const auto judges = raw.find("judges");
    if (judges != raw.end() && judges->is_object())
        for (const auto& item : judges->items())
        {
            if (!item.value().is_object()) continue;
            result.judges.push_back({item.key(), OptionalInt(item.value(), "playerId"),
                Ids(item.value(), "playerIds"), detail::ReadInt(item.value(), "index")});
        }
    return result.stage.empty() && result.sessions.empty() && result.judges.empty()
        ? std::nullopt : std::optional<domain::GameSubmissionsView>(std::move(result));
}

std::optional<domain::GameEffectView> GameWorkflowCapabilitiesDecoder::Effect(
    const nlohmann::json& raw)
{
    if (!raw.is_object() || raw.empty()) return std::nullopt;
    domain::GameEffectView result;
    const auto source = raw.find("source");
    if (source != raw.end() && source->is_object())
    {
        result.sourcePlayerId = OptionalInt(*source, "playerId");
        result.sourceCardId = PrimitiveId(*source, "cardId");
        result.sourceDeckId = PrimitiveId(*source, "deckId");
        result.sourceTileId = PrimitiveId(*source, "tileId");
    }
    result.status = detail::ReadString(raw, "status");
    result.resolved = detail::ReadBool(raw, "resolved") || result.status == "resolved";
    return result;
}

std::vector<domain::GameTimerView> GameWorkflowCapabilitiesDecoder::Timers(
    const nlohmann::json& raw)
{
    std::vector<domain::GameTimerView> result;
    if (!raw.is_object()) return result;
    for (const auto& item : raw.items())
    {
        domain::GameTimerView timer;
        timer.id = item.key();
        if (item.value().is_object())
        {
            timer.label = detail::ReadString(item.value(), "label");
            timer.actionType = detail::ReadString(item.value(), "actionType");
            timer.deadlineMs = OptionalInt64(item.value(), "deadlineMs");
            timer.remainingMs = OptionalInt64(item.value(), "remainingMs");
            timer.paused = detail::ReadBool(item.value(), "paused");
        }
        else if (item.value().is_number_integer())
            timer.remainingMs = item.value().get<std::int64_t>();
        result.push_back(std::move(timer));
    }
    return result;
}
}
