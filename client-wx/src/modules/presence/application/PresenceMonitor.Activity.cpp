#include "modules/presence/application/PresenceMonitor.h"
#include <algorithm>
#include <chrono>
#include "modules/session/application/SessionStore.h"
#include "modules/presence/infrastructure/PresencePayloadCodec.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

namespace lila::modules::presence::application
{
bool PresenceMonitor::ApplyLocalContext(
    std::vector<domain::PresencePlayer>& players,
    int currentUserId,
    std::string_view context)
{
    const auto current = std::ranges::find_if(
        players, [currentUserId](const domain::PresencePlayer& player)
        {
            return player.id == currentUserId;
        });
    if (current == players.end() || current->activity == context) return false;
    current->activity = context;
    current->location.clear();
    current->currentRoomId.reset();
    current->currentRoomName.clear();
    return true;
}

void PresenceMonitor::SetContext(std::string context)
{
    const int currentUserId = static_cast<int>(sessionStore_.Current().userId.value);
    PlayersChangedHandler handler;
    {
        std::scoped_lock lock(mutex_);
        if (context_ == context) return;
        context_ = std::move(context);
        contextAwaitingConfirmation_ = context_;
        contextDirty_ = true;
        if (ApplyLocalContext(players_, currentUserId, context_))
            handler = onPlayersChanged_;
    }
    NotifyChanged(handler);
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
                webSocketClient_.Send(infrastructure::WritePresenceContext(context));
            else if (sendActivity)
                webSocketClient_.Send(infrastructure::PresenceActivityMessage());
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
