#include "modules/presence/application/PresenceMonitor.h"

#include <algorithm>
#include <exception>
#include <utility>

#include "modules/audio/application/IAudioService.h"
#include "modules/presence/infrastructure/PresenceConnectionFactory.h"
#include "modules/presence/infrastructure/PresencePayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/websocket/IWebSocketClient.h"

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
    if (receiveTask_ != nullptr || !sessionStore_.HasActiveSession())
    {
        return;
    }

    receiveTask_ = lila::shared::concurrency::RunAsync(
        [this](std::stop_token stopToken)
        {
            ReceiveLoop(stopToken);
        },
        [this](std::optional<lila::shared::errors::AppError>)
        {
            receiveTask_.reset();
            SetStatus("Presence deconnectee.");
        });
}

void PresenceMonitor::Stop()
{
    if (receiveTask_ != nullptr)
    {
        receiveTask_->RequestCancel();
        receiveTask_.reset();
    }
    try
    {
        webSocketClient_.Close();
    }
    catch (...)
    {
    }

    std::scoped_lock lock(mutex_);
    players_.clear();
    status_ = "Presence deconnectee.";
    hasSnapshot_ = false;
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

std::optional<int> PresenceMonitor::CurrentRoomId() const noexcept
{
    return currentRoomId_;
}

void PresenceMonitor::ReceiveLoop(std::stop_token stopToken)
{
    Connect();
    while (!stopToken.stop_requested())
    {
        ApplyUpdate(webSocketClient_.Receive());
    }
}

void PresenceMonitor::Connect()
{
    const auto connect = [this](const std::string& token)
    {
        webSocketClient_.Connect(
            endpoint_,
            lila::modules::presence::infrastructure::BuildPresenceHeaders(ticketProvider_, token));
    };
    try
    {
        connect(sessionStore_.AccessToken());
    }
    catch (const lila::shared::network::http::WsTicketRequestError& exception)
    {
        if (exception.StatusCode() != 401 && exception.StatusCode() != 403)
        {
            throw;
        }
        webSocketClient_.Close();
        connect(sessionStore_.RefreshAccessToken());
    }
    webSocketClient_.Send(lila::modules::presence::infrastructure::TavernContextPayload());
    SetStatus("Presence connectee.");
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
