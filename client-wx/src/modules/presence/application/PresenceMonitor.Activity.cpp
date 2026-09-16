#include "modules/presence/application/PresenceMonitor.h"
#include <chrono>
#include <nlohmann/json.hpp>
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::modules::presence::application
{
void PresenceMonitor::SetContext(std::string context)
{
    std::scoped_lock lock(mutex_);
    if (context_ == context) return;
    context_ = std::move(context);
    contextDirty_ = true;
}

void PresenceMonitor::ReportInteraction()
{
    std::scoped_lock lock(mutex_);
    interactionDirty_ = true;
}

void PresenceMonitor::PublishActivity(std::stop_token stopToken)
{
    std::mutex waitMutex;
    std::condition_variable_any wake;
    while (!stopToken.stop_requested())
    {
        std::string context;
        bool sendContext = false;
        bool sendActivity = false;
        {
            std::scoped_lock lock(mutex_);
            if (webSocketClient_.IsConnected())
            {
                context = context_;
                sendContext = contextDirty_;
                sendActivity = interactionDirty_;
                contextDirty_ = interactionDirty_ = false;
            }
        }
        try
        {
            if (sendContext)
                webSocketClient_.Send(nlohmann::json{{"type", "presence-context"}, {"context", context}}.dump());
            else if (sendActivity)
                webSocketClient_.Send(R"({"type":"presence-activity"})");
        }
        catch (...)
        {
            std::scoped_lock lock(mutex_);
            contextDirty_ = contextDirty_ || sendContext;
            interactionDirty_ = interactionDirty_ || sendActivity;
        }
        std::unique_lock lock(waitMutex);
        wake.wait_for(lock, stopToken, std::chrono::seconds(1), [] { return false; });
    }
}
}
