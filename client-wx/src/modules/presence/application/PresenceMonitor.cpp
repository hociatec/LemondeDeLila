#include "modules/presence/application/PresenceMonitor.h"

#include <algorithm>
#include <exception>
#include <utility>

#include "modules/audio/application/IAudioService.h"
#include "modules/presence/infrastructure/PresenceConnectionFactory.h"
#include "modules/presence/infrastructure/PresencePayloadCodec.h"
#include "modules/session/application/SessionConnectionRetry.h"
#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/AuthenticatedWebSocketHeaders.h"
#include "shared/network/application/websocket/IWebSocketClient.h"
#include "shared/network/domain/WebSocketConstants.h"

namespace lila::modules::presence::application
{
PresenceMonitor::PresenceMonitor(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& webSocketClient,
    lila::shared::network::http::IWsTicketProvider& ticketProvider,
    lila::modules::session::application::SessionStore& sessionStore,
    lila::modules::audio::application::IAudioService& audioService,
    std::function<bool(int)> isFriend)
    : endpoint_(std::move(endpoint)),
      webSocketClient_(webSocketClient),
      ticketProvider_(ticketProvider),
      sessionStore_(sessionStore),
      audioService_(audioService),
      isFriend_(std::move(isFriend))
{
}

PresenceMonitor::~PresenceMonitor()
{
    Stop();
}

void PresenceMonitor::Start()
{
    if (receiveThread_.joinable() || !sessionStore_.HasActiveSession())
    {
        return;
    }

    receiveThread_ = std::jthread([this](std::stop_token token) { ReceiveLoop(token); });
    activityThread_ = std::jthread([this](std::stop_token token) { PublishActivity(token); });
}

void PresenceMonitor::Stop()
{
    activityThread_.request_stop();
    receiveThread_.request_stop();
    try
    {
        webSocketClient_.Close();
    }
    catch (...)
    {
    }
    if (activityThread_.joinable()) activityThread_.join();
    if (receiveThread_.joinable()) receiveThread_.join();

    std::scoped_lock lock(mutex_);
    players_.clear();
    status_ = "Présence déconnectée.";
    hasSnapshot_ = false;
    context_ = "home";
    contextDirty_ = true;
    interactionDirty_ = false;
}

void PresenceMonitor::SetPlayersChangedHandler(PlayersChangedHandler handler)
{
    std::scoped_lock lock(mutex_);
    onPlayersChanged_ = std::move(handler);
}

std::vector<domain::PresencePlayer> PresenceMonitor::Players() const
{
    std::scoped_lock lock(mutex_);
    return players_;
}

std::string PresenceMonitor::Status() const
{
    std::scoped_lock lock(mutex_);
    return status_;
}

bool PresenceMonitor::HasSnapshot() const
{
    std::scoped_lock lock(mutex_);
    return hasSnapshot_;
}

void PresenceMonitor::ReceiveLoop(std::stop_token stopToken)
{
    while (!stopToken.stop_requested())
    {
        try
        {
            Connect(stopToken);
            while (!stopToken.stop_requested()) ApplyUpdate(webSocketClient_.Receive());
        }
        catch (...)
        {
            if (stopToken.stop_requested()) break;
            SetStatus("Reconnexion de la présence...");
            std::mutex waitMutex;
            std::condition_variable_any wake;
            std::unique_lock lock(waitMutex);
            wake.wait_for(lock, stopToken, std::chrono::seconds(1), [] { return false; });
        }
    }
}

void PresenceMonitor::Connect(std::stop_token stopToken)
{
    const auto connect = [this, stopToken](const std::string& token)
    {
        webSocketClient_.Connect(
            endpoint_,
            lila::shared::network::websocket::BuildAuthenticatedHeaders(
                ticketProvider_, lila::shared::network::ws::WsTicketScopePresence, token),
            stopToken);
    };
    lila::modules::session::application::ConnectWithSessionRefresh(
        sessionStore_, stopToken, [this] { webSocketClient_.Close(); }, connect);
    // The first snapshot after every connection is a baseline, not live arrivals.
    { std::scoped_lock lock(mutex_); hasSnapshot_ = false; }
    { std::scoped_lock lock(mutex_); contextDirty_ = true; }
    SetStatus("Présence connectée.");
}

void PresenceMonitor::ApplyUpdate(const std::string& rawJson)
{
    auto next = lila::modules::presence::infrastructure::ReadPresenceUpdate(rawJson);
    if (!next.has_value())
    {
        return;
    }

    PlayersChangedHandler handler;
    std::vector<int> connected;
    std::vector<int> disconnected;
    {
        std::scoped_lock lock(mutex_);
        if (hasSnapshot_)
        {
            if (players_ == *next) return;
            for (const auto& player : *next)
            {
                const bool wasPresent = std::ranges::any_of(
                    players_,
                    [&player](const domain::PresencePlayer& previous)
                    {
                        return previous.id == player.id;
                    });
                if (!wasPresent) connected.push_back(player.id);
            }
            for (const auto& previous : players_)
            {
                const bool isPresent = std::ranges::any_of(
                    *next,
                    [&previous](const domain::PresencePlayer& player)
                    {
                        return player.id == previous.id;
                    });
                if (!isPresent) disconnected.push_back(previous.id);
            }
        }
        players_ = std::move(*next);
        hasSnapshot_ = true;
        handler = onPlayersChanged_;
    }
    if (isFriend_ && std::ranges::any_of(connected, isFriend_))
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::FriendConnected);
    }
    if (isFriend_ && std::ranges::any_of(disconnected, isFriend_))
    {
        audioService_.Play(lila::modules::audio::domain::SoundCue::FriendDisconnected);
    }
    NotifyChanged(handler);
}

void PresenceMonitor::SetStatus(std::string status)
{
    PlayersChangedHandler handler;
    {
        std::scoped_lock lock(mutex_);
        status_ = std::move(status);
        handler = onPlayersChanged_;
    }
    NotifyChanged(handler);
}

void PresenceMonitor::NotifyChanged(const PlayersChangedHandler& handler) const
{
    if (handler)
    {
        handler();
    }
}
}
