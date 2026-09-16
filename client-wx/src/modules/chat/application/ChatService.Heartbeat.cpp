#include "modules/chat/application/ChatService.h"

#include <algorithm>
#include <chrono>
#include <thread>

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
        for (auto remaining = HeartbeatInterval; remaining.count() > 0 && !stopToken.stop_requested();
             remaining -= std::min(remaining, std::chrono::milliseconds(100)))
            std::this_thread::sleep_for(std::min(remaining, std::chrono::milliseconds(100)));
        if (stopToken.stop_requested() || !IsLifecycleCurrent(lifecycleGeneration)) return;
        try { SendRawJson(std::string(PresenceSyncPayload)); }
        catch (...) { }
    }
}
}
