#include "modules/presence/application/PresenceMonitor.h"

#include <exception>
#include <utility>

#include "modules/presence/infrastructure/PresenceConnectionFactory.h"
#include "modules/presence/infrastructure/PresencePayloadCodec.h"
#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/network/websocket/IWebSocketClient.h"

namespace lila::modules::presence::application
{
PresenceMonitor::PresenceMonitor(
    std::string endpoint,
    lila::shared::network::websocket::IWebSocketClient& webSocketClient,
    lila::shared::network::http::WsTicketProvider& ticketProvider,
    lila::modules::session::application::SessionStore& sessionStore)
    : endpoint_(std::move(endpoint)),
      webSocketClient_(webSocketClient),
      ticketProvider_(ticketProvider),
      sessionStore_(sessionStore)
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
    const auto& session = sessionStore_.Current();
    webSocketClient_.Connect(
        endpoint_,
        lila::modules::presence::infrastructure::BuildPresenceHeaders(ticketProvider_, session.token));
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
    {
        std::scoped_lock lock(mutex_);
        players_ = std::move(*next);
        hasSnapshot_ = true;
        handler = onPlayersChanged_;
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
