#include "modules/gameplay/session/infrastructure/GameEventPayloadCodec.h"

#include <utility>

#include <nlohmann/json.hpp>

#include "modules/gameplay/state/infrastructure/GameStatePayloadCodec.h"
#include "modules/gameplay/session/infrastructure/GameCommandPayloadCodec.h"
#include "shared/errors/application/PresentedErrorPayload.h"

namespace lila::modules::gameplay::infrastructure
{
namespace
{
std::string ReadString(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    return found != value.end() && found->is_string()
        ? found->get<std::string>()
        : std::string{};
}

bool ReadBoolean(const nlohmann::json& value, const char* field)
{
    const auto found = value.find(field);
    return found != value.end() && found->is_boolean()
        ? found->get<bool>()
        : false;
}
}

domain::GameEvent GameEventPayloadCodec::Decode(const nlohmann::json& message)
{
    if (!message.is_object())
        return {domain::GameEventType::Ignored, std::nullopt, {}, false,
            std::nullopt, {}, std::nullopt, {}};
    const auto type = ReadString(message, "type");
    const auto payload = message.value("payload", nlohmann::json::object());
    if (type == "game.state")
    {
        return {domain::GameEventType::StateUpdated,
            GameStatePayloadCodec::DecodeState(payload), {}, false,
            std::nullopt, {}, std::nullopt, {}};
    }
    if (type == "game.ack")
    {
        domain::GameAcknowledgement acknowledgement;
        acknowledgement.command = ReadString(payload, "action");
        acknowledgement.ok = ReadBoolean(payload, "ok");
        acknowledgement.key = ReadString(payload, "key");
        acknowledgement.panelId = ReadString(payload, "panelId");
        acknowledgement.roomOperation = ReadString(payload, "roomOp");
        acknowledgement.message = ReadString(payload, "message");
        return {domain::GameEventType::Acknowledged, std::nullopt,
            acknowledgement.command, !acknowledgement.ok,
            std::move(acknowledgement), {}, std::nullopt, {}};
    }
    if (type == "game.turn")
    {
        return {domain::GameEventType::TurnUpdated, std::nullopt,
            ReadString(payload, "currentPlayerUsername"), false,
            std::nullopt, {}, std::nullopt, {}};
    }
    if (type == "game.action.candidates")
    {
        domain::GameEvent event;
        event.type = domain::GameEventType::ActionCandidates;
        event.candidates = GameCommandPayloadCodec::DecodeCandidates(payload);
        return event;
    }
    if (type == "game.rules")
    {
        domain::GameEvent event;
        event.type = domain::GameEventType::Rules;
        event.rules = ReadString(payload, "rules");
        return event;
    }
    if (type == "error")
    {
        auto messageText = lila::shared::errors::PresentedErrorMessage(
            payload, "Action de jeu impossible.");
        domain::GameEvent event;
        event.type = domain::GameEventType::Error;
        event.message = std::move(messageText);
        event.isError = true;
        event.errorCode = ReadString(payload, "code");
        return event;
    }
    return {domain::GameEventType::Ignored, std::nullopt, {}, false,
        std::nullopt, {}, std::nullopt, {}};
}
}
