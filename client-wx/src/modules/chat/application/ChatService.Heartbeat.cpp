#include "modules/chat/application/ChatService.h"

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <exception>
#include <mutex>

#include "shared/logging/application/Logger.h"

namespace lila::modules::chat::application
{
namespace
{
constexpr auto HeartbeatInterval = std::chrono::seconds(15);
constexpr std::string_view PresenceSyncPayload = R"({"type":"presence-sync"})";
}

void ChatService::StartHeartbeat(std::uint64_t lifecycleGeneration)
{
    StopHeartbeat();
    heartbeatTask_ = lila::shared::concurrency::RunAsync(
        [this, lifecycleGeneration](std::stop_token stopToken)
        {
            HeartbeatLoop(stopToken, lifecycleGeneration);
        }, {}, lila::shared::concurrency::BackgroundTaskPriority::High,
        "Heartbeat du tchat interrompu.");
}

void ChatService::StopHeartbeat() noexcept
{
    if (heartbeatTask_ == nullptr) return;
    heartbeatTask_->RequestCancel();
    heartbeatTask_.reset();
}

void ChatService::HeartbeatLoop(std::stop_token stopToken, std::uint64_t lifecycleGeneration)
{
    while (!stopToken.stop_requested() && IsLifecycleCurrent(lifecycleGeneration))
    {
        std::mutex waitMutex;
        std::condition_variable_any wake;
        std::unique_lock lock(waitMutex);
        wake.wait_for(lock, stopToken, HeartbeatInterval, [] { return false; });
        if (stopToken.stop_requested() || !IsLifecycleCurrent(lifecycleGeneration)) return;
        try
        {
            SendRawJson(std::string(PresenceSyncPayload));
        }
        catch (const std::exception& exception)
        {
            lila::shared::logging::LogWarning("Chat", "Heartbeat non envoyé: " + std::string(exception.what()));
        }
        catch (...)
        {
            lila::shared::logging::LogWarning("Chat", "Heartbeat non envoyé: erreur inconnue.");
        }
    }
}
}
