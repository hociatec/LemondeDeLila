#include "modules/rooms/infrastructure/RoomSessionGateway.h"

#include <optional>

#include <nlohmann/json.hpp>

#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/rooms/infrastructure/RoomProtocol.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::modules::rooms::infrastructure
{
namespace
{
std::optional<domain::RoomChatMessage> ReadChatMessage(const nlohmann::json& payload)
{
    if (!payload.is_object()) return std::nullopt;
    domain::RoomChatMessage result;
    result.userId = payload.value("userId", 0);
    result.username = payload.value("username", std::string{});
    result.message = payload.value("message", std::string{});
    if (result.message.empty()) return std::nullopt;
    return result;
}
}

domain::RoomEvent RoomSessionGateway::ReceiveEvent(std::stop_token stopToken)
{
    if (stopToken.stop_requested()) return {};
    {
        std::scoped_lock lock(pendingEventsMutex_);
        if (!pendingEvents_.empty())
        {
            auto event = std::move(pendingEvents_.front());
            pendingEvents_.pop_front();
            return event;
        }
    }
    return DecodeEvent(nlohmann::json::parse(client_.Receive()));
}

void RoomSessionGateway::CompleteAcknowledgement(std::string_view traceId)
{
    if (traceId.empty()) return;
    {
        std::scoped_lock lock(pendingCommandsMutex_);
        const auto pending = pendingCommands_.find(std::string(traceId));
        if (pending == pendingCommands_.end()) return;
        pending->second.completed = true;
    }
    pendingCommandsCondition_.notify_all();
}

bool RoomSessionGateway::FailPendingCommands(std::string_view message)
{
    bool found = false;
    {
        std::scoped_lock lock(pendingCommandsMutex_);
        for (auto& [traceId, pending] : pendingCommands_)
        {
            static_cast<void>(traceId);
            if (pending.completed) continue;
            pending.completed = true;
            pending.error = std::string(message);
            found = true;
        }
    }
    if (found) pendingCommandsCondition_.notify_all();
    return found;
}

domain::RoomEvent RoomSessionGateway::DecodeEvent(const nlohmann::json& message)
{
    const auto type = message.value("type", std::string{});
    const auto payload = message.value("payload", nlohmann::json::object());
    if (type == protocol::Error)
    {
        auto error = payload.value("message", std::string("Action de table impossible."));
        if (FailPendingCommands(error)) return {};
        return {domain::RoomEventType::Error, {}, {}, std::move(error)};
    }
    if (type == protocol::Ack)
    {
        CompleteAcknowledgement(payload.value("traceId", std::string{}));
        return {};
    }
    if (type == protocol::Pong) return {};
    if (type == protocol::Left || type == protocol::Deleted)
        return {domain::RoomEventType::Closed, {}, {}, "La table n'est plus disponible."};
    if (type == protocol::Created || type == protocol::Joined || type == protocol::Updated)
    {
        auto room = codec::ReadRoomState(payload);
        room.selfSpectator = selfSpectator_.load();
        return {domain::RoomEventType::StateUpdated, std::move(room)};
    }
    if (type == protocol::InfoResult)
        return {domain::RoomEventType::Info, {}, {}, payload.value("message", std::string{})};
    if (type == protocol::Privacy)
    {
        const auto isPrivate = payload.value("isPrivate", false);
        return {domain::RoomEventType::PrivacyChanged, {}, {}, {}, isPrivate};
    }
    if (type == protocol::Role)
    {
        const auto spectator = payload.value("spectator", selfSpectator_.load());
        selfSpectator_.store(spectator);
        return {domain::RoomEventType::RoleChanged, {}, {}, payload.value("message", std::string{}), spectator};
    }
    if (type == protocol::Intent && payload.value("type", std::string{}) == "announcement")
    {
        const auto details = payload.value("payload", nlohmann::json::object());
        return {domain::RoomEventType::Announcement, {}, {}, details.value("message", std::string{})};
    }
    if (type == protocol::ChatMessage)
    {
        auto chat = ReadChatMessage(payload);
        if (!chat) return {};
        return {domain::RoomEventType::ChatMessage, {}, {std::move(*chat)}};
    }
    if (type == protocol::ChatHistory)
    {
        domain::RoomEvent event;
        event.type = domain::RoomEventType::ChatHistory;
        const auto messages = payload.find("messages");
        if (messages != payload.end() && messages->is_array())
            for (const auto& value : *messages)
                if (auto chat = ReadChatMessage(value)) event.chatMessages.push_back(std::move(*chat));
        return event;
    }
    return {};
}
}
