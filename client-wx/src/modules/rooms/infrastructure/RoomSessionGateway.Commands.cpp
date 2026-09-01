#include "modules/rooms/infrastructure/RoomSessionGateway.h"

#include <chrono>
#include <stdexcept>

#include <nlohmann/json.hpp>

#include "modules/rooms/infrastructure/RoomCommandProtocol.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::modules::rooms::infrastructure
{
std::string RoomSessionGateway::CreateTraceId()
{
    const auto now = std::chrono::duration_cast<std::chrono::microseconds>(
        std::chrono::system_clock::now().time_since_epoch()).count();
    return std::to_string(now) + "-" + std::to_string(traceCounter_.fetch_add(1));
}

void RoomSessionGateway::Execute(
    const domain::RoomCommandRequest& request,
    std::stop_token stopToken)
{
    if (stopToken.stop_requested()) return;
    const auto roomId = roomId_.load();
    if (roomId <= 0 || !client_.IsConnected())
        throw std::runtime_error("Aucune table active.");

    nlohmann::json payload = nlohmann::json::object();
    if (request.command == domain::RoomCommand::SetRole)
    {
        payload["roomId"] = roomId;
        payload["spectator"] = request.spectator;
    }
    else if (request.command == domain::RoomCommand::SendChat)
    {
        if (request.message.empty()) return;
        payload["message"] = request.message;
    }
    else if (request.command == domain::RoomCommand::Ping)
    {
        payload["clientSentAtMs"] = std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
    }
    else if (request.command == domain::RoomCommand::Kick ||
        request.command == domain::RoomCommand::Ban ||
        request.command == domain::RoomCommand::SetOwner)
    {
        if (request.targetUserId <= 0) throw std::invalid_argument("Joueur cible invalide.");
        payload["userId"] = request.targetUserId;
    }
    else if (request.command == domain::RoomCommand::SetAmbience)
    {
        payload["soundId"] = request.message;
    }

    const auto traceId = CreateTraceId();
    const nlohmann::json trace = {
        {"id", traceId},
        {"sentAtMs", std::chrono::duration_cast<std::chrono::milliseconds>(
            std::chrono::system_clock::now().time_since_epoch()).count()}};
    const bool awaitAcknowledgement = command_protocol::NeedsAcknowledgement(request.command);
    if (awaitAcknowledgement)
    {
        std::scoped_lock lock(pendingCommandsMutex_);
        pendingCommands_.emplace(traceId, PendingCommand{});
    }

    try
    {
        SendJson(nlohmann::json{
            {"type", protocol::IntentExecute},
            {"payload", {
                {"intentId", command_protocol::Type(request.command)},
                {"data", std::move(payload)},
                {"_trace", trace}}}});
    }
    catch (...)
    {
        if (awaitAcknowledgement)
        {
            std::scoped_lock lock(pendingCommandsMutex_);
            pendingCommands_.erase(traceId);
        }
        throw;
    }

    if (!awaitAcknowledgement) return;

    std::unique_lock lock(pendingCommandsMutex_);
    std::stop_callback cancelWait(stopToken, [this]() { pendingCommandsCondition_.notify_all(); });
    const bool completed = pendingCommandsCondition_.wait_for(
        lock,
        std::chrono::seconds(3),
        [this, &traceId, stopToken]()
        {
            const auto pending = pendingCommands_.find(traceId);
            return stopToken.stop_requested() ||
                pending == pendingCommands_.end() || pending->second.completed;
        });
    const auto pending = pendingCommands_.find(traceId);
    const auto error = pending == pendingCommands_.end() ? std::string{} : pending->second.error;
    pendingCommands_.erase(traceId);
    lock.unlock();

    if (stopToken.stop_requested()) return;
    if (!completed)
        throw std::runtime_error(
            std::string("Le serveur n'a pas confirm" "\xC3\xA9" " la commande de table."));
    if (!error.empty()) throw std::runtime_error(error);
}
}
