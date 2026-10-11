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
    std::string_view context, std::optional<int> roomId, std::string_view roomName)
{
    const auto current = std::ranges::find_if(
        players, [currentUserId](const domain::PresencePlayer& player)
        {
            return player.id == currentUserId;
        });
    if (current == players.end()) return false;
    if (current->activity == context && current->currentRoomId == roomId &&
        current->currentRoomName == roomName) return false;
    current->activity = context;
    current->location.clear();
    current->currentRoomId = roomId;
    current->currentRoomName = roomName;
    return true;
}

void PresenceMonitor::SetContext(std::string context, std::optional<int> roomId, std::string roomName)
{
    if (context != "table" || !roomId.has_value() || *roomId <= 0)
    {
        roomId.reset();
        roomName.clear();
    }
    // Navigation also reports context before login and after session expiry.
    // Read the optional session atomically so a concurrent logout is harmless.
    const auto session = sessionStore_.TryCurrent();
    PlayersChangedHandler handler;
    {
        std::scoped_lock lock(mutex_);
        if (context_ == context && roomId_ == roomId && roomName_ == roomName) return;
        context_ = std::move(context);
        roomId_ = roomId;
        roomName_ = std::move(roomName);
        contextAwaitingConfirmation_ = session
            ? std::optional<std::string>(context_) : std::nullopt;
        contextDirty_ = true;
        if (session && ApplyLocalContext(
                players_, static_cast<int>(session->userId.value), context_, roomId_, roomName_))
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
        std::optional<int> roomId;
        std::string roomName;
        bool sendContext = false;
        bool sendActivity = false;
        {
            std::scoped_lock lock(mutex_);
            if (webSocketClient_.IsConnected())
            {
                context = context_;
                roomId = roomId_;
                roomName = roomName_;
                sendContext = contextDirty_;
                sendActivity = interactionDirty_;
                contextDirty_ = interactionDirty_ = false;
            }
        }
        try
        {
            if (sendContext)
                webSocketClient_.Send(infrastructure::WritePresenceContext(context, roomId, roomName));
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
