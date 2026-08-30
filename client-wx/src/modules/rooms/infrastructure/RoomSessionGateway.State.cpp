#include "modules/rooms/infrastructure/RoomSessionGateway.h"

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <mutex>
#include <stdexcept>
#include <thread>

#include <nlohmann/json.hpp>

#include "modules/rooms/infrastructure/RoomPayloadCodec.h"
#include "modules/rooms/infrastructure/RoomProtocol.h"
#include "modules/rooms/domain/RoomErrorMessages.h"
#include "shared/errors/domain/AppError.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::modules::rooms::infrastructure
{
domain::RoomState RoomSessionGateway::AwaitState(
    std::optional<int> expectedRoomId,
    std::string_view requiredMessageType,
    std::stop_token stopToken)
{
    using namespace std::chrono_literals;
    std::atomic_bool timedOut = false;
    std::mutex deadlineMutex;
    std::condition_variable_any deadlineCondition;
    std::jthread deadline(
        [this, &timedOut, &deadlineMutex, &deadlineCondition](std::stop_token timerStop)
        {
            std::unique_lock lock(deadlineMutex);
            static_cast<void>(deadlineCondition.wait_for(
                lock, timerStop, 15s, [] { return false; }));
            if (timerStop.stop_requested()) return;
            timedOut.store(true);
            client_.CancelPendingOperation();
        });
    std::stop_callback cancellation(
        stopToken, [this] { client_.CancelPendingOperation(); });

    try
    {
        while (!stopToken.stop_requested())
        {
            const auto message = nlohmann::json::parse(client_.Receive());
            const auto messageType = message.value("type", std::string{});
            lila::shared::logging::LogInfo("Rooms", "RX " + messageType);
            auto event = DecodeEvent(message);
            if (event.type == domain::RoomEventType::Error)
            {
                const auto userMessage = event.message.empty()
                    ? std::string(lila::shared::errors::RoomConnectionFailed)
                    : event.message;
                throw lila::shared::errors::AppException(
                    lila::shared::errors::ToAppError(
                        userMessage, "Room handshake rejected: " + message.dump()));
            }
            if (event.type == domain::RoomEventType::Closed)
                throw std::runtime_error("La table n'est plus disponible.");
            if (event.type == domain::RoomEventType::StateUpdated && event.room)
            {
                const bool messageMatches = requiredMessageType.empty() ||
                    messageType == requiredMessageType;
                const bool roomMatches = !expectedRoomId || event.room->id == *expectedRoomId;
                if (messageMatches && roomMatches) return std::move(*event.room);
                lila::shared::logging::LogWarning(
                    "Rooms", "State ignored during handshake: type=" + messageType +
                        " roomId=" + std::to_string(event.room->id));
                continue;
            }
            if (event.type != domain::RoomEventType::Ignored)
            {
                std::scoped_lock lock(pendingEventsMutex_);
                pendingEvents_.push_back(std::move(event));
            }
        }
    }
    catch (const std::exception& error)
    {
        if (timedOut.load())
            throw lila::shared::errors::AppException(
                lila::shared::errors::ToAppError(
                    lila::shared::errors::RoomConnectionFailed,
                    "Room handshake timed out after 15 seconds."));
        if (stopToken.stop_requested())
            throw std::runtime_error("Connexion à la table interrompue.");
        lila::shared::logging::LogError(
            "Rooms", std::string("Room handshake failed: ") + error.what());
        throw;
    }
    throw std::runtime_error("Connexion à la table interrompue.");
}
}
