#include "modules/chat/application/ChatService.h"

#include <algorithm>
#include <chrono>
#include <stdexcept>
#include <string>
#include <thread>

#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/infrastructure/ChatProtocolFields.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/AppConfig.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/network/http/WsTicketProvider.h"

namespace lila::modules::chat::application
{
namespace
{
std::chrono::milliseconds ResolveReconnectDelay(int reconnectAttempt)
{
    const int initialDelayMs = std::max(1, lila::shared::config::AppConfig::ResolveChatReconnectInitialDelayMs());
    const int maxDelayMs = std::max(initialDelayMs, lila::shared::config::AppConfig::ResolveChatReconnectMaxDelayMs());

    int delay = initialDelayMs;
    for (int index = 0; index < reconnectAttempt; ++index)
    {
        delay = std::min(maxDelayMs, delay * 2);
    }

    return std::chrono::milliseconds(delay);
}

bool WaitForDelay(std::stop_token stopToken, std::chrono::milliseconds delay)
{
    constexpr auto PollStep = std::chrono::milliseconds(100);
    auto remaining = delay;
    while (remaining.count() > 0)
    {
        if (stopToken.stop_requested())
        {
            return true;
        }

        const auto sleepDuration = std::min(PollStep, remaining);
        std::this_thread::sleep_for(sleepDuration);
        remaining -= sleepDuration;
    }

    return stopToken.stop_requested();
}
}

void ChatService::StopReceiveLoop() noexcept
{
    if (receiveTask_ == nullptr)
    {
        return;
    }

    receiveTask_->RequestCancel();
    gateway_.Interrupt();
    receiveTask_.reset();
}

bool ChatService::Open()
{
    Close();

    if (!optionsStore_.Current().chatEnabled)
    {
        SetStatus(lila::shared::errors::ChatDisabled, true);
        return false;
    }

    if (!sessionStore_.HasActiveSession() || !sessionStore_.Current().IsAuthenticated())
    {
        SetStatus(lila::shared::errors::ChatLoginRequired, true);
        return false;
    }

    try
    {
        {
            std::scoped_lock lock(mutex_);
            messagesStore_.LoadHistory({}, lila::modules::chat::infrastructure::fields::DefaultHistoryLoadLimit);
            lastServerError_.reset();
            reconnectAttempt_ = 0;
        }

        SetState(domain::ChatState::Connecting);
        SetStatus(lila::shared::errors::ChatConnecting, false);

        gateway_.Open(sessionStore_.Current().token, shared::config::AppConfig::ResolveClientVersion());
        SetStatus(lila::shared::errors::ChatAuthenticating, false);
        SetState(domain::ChatState::Connected);

        SetStatus(lila::shared::errors::ChatLoadingData, false);
        ProcessIncomingMessage(gateway_.Receive(), true);
        if (State() == domain::ChatState::Error)
        {
            Close();
            return false;
        }

        SetStatus(lila::shared::errors::ChatConnected, false);
        StartReceiveLoop();
        return true;
    }
    catch (const lila::shared::network::http::WsTicketRequestError& exception)
    {
        SetState(domain::ChatState::Error);
        sessionStore_.Clear();
        {
            std::scoped_lock lock(mutex_);
            lastServerError_ = domain::ChatServerError{exception.what(), {}, std::nullopt};
        }
        SetStatus(
            lila::shared::errors::WithDetails(
                lila::shared::errors::ChatConnectionFailed,
                std::string(lila::shared::errors::WsTicketRejectedByApiPrefix)
                    + std::to_string(exception.StatusCode())
                    + "), reconnectez-vous."),
            true);
        Close();
        return false;
    }
    catch (const std::exception& exception)
    {
        SetState(domain::ChatState::Error);
        const std::string exceptionMessage = exception.what();
        {
            std::scoped_lock lock(mutex_);
            if (!exceptionMessage.empty())
            {
                lastServerError_ = domain::ChatServerError{
                    exceptionMessage,
                    {},
                    std::nullopt};
            }
        }
        SetStatus(lila::shared::errors::WithDetails(lila::shared::errors::ChatConnectionFailed, exception.what()), true);
        Close();
        return false;
    }
}

void ChatService::Close()
{
    StopReceiveLoop();

    bool shouldNotifyClosed = true;
    {
        std::scoped_lock lock(mutex_);
        shouldNotifyClosed = state_ != domain::ChatState::Error;
        messagesStore_.Clear();
    }

    gateway_.Close();

    SetState(domain::ChatState::Disconnected);
    if (shouldNotifyClosed)
    {
        SetStatus(lila::shared::errors::ChatClosed, false);
    }
}

void ChatService::Send(const std::string& text)
{
    if (text.empty())
    {
        return;
    }

    try
    {
        SendRawJson(protocol_.BuildSendPayload(text));
    }
    catch (const std::exception& exception)
    {
        const std::string failure = lila::shared::errors::WithDetails(
            lila::shared::errors::ChatSendFailed,
            exception.what());
        lila::shared::logging::LogError("Chat", failure);
        SetStatus(failure, true);
        throw std::runtime_error(failure);
    }
}

void ChatService::Edit(const std::string& messageId, const std::string& text)
{
    if (messageId.empty())
    {
        return;
    }

    try
    {
        SendRawJson(protocol_.BuildEditPayload(messageId, text));
    }
    catch (const std::exception& exception)
    {
        const std::string failure = lila::shared::errors::WithDetails(
            lila::shared::errors::ChatEditFailed,
            exception.what());
        lila::shared::logging::LogError("Chat", failure);
        SetStatus(failure, true);
        throw std::runtime_error(failure);
    }
}

void ChatService::Delete(const std::string& messageId)
{
    if (messageId.empty())
    {
        return;
    }

    try
    {
        SendRawJson(protocol_.BuildDeletePayload(messageId));
    }
    catch (const std::exception& exception)
    {
        const std::string failure = lila::shared::errors::WithDetails(
            lila::shared::errors::ChatDeleteFailed,
            exception.what());
        lila::shared::logging::LogError("Chat", failure);
        SetStatus(failure, true);
        throw std::runtime_error(failure);
    }
}

void ChatService::StartReceiveLoop()
{
    receiveTask_ = lila::shared::concurrency::RunAsync(
        [this](std::stop_token stopToken)
        {
            ReceiveLoop(stopToken);
        },
        {},
        lila::shared::concurrency::BackgroundTaskPriority::High,
        lila::shared::errors::ChatReconnectionInterrupted);
}

void ChatService::ReceiveLoop(std::stop_token stopToken)
{
    while (true)
    {
        if (stopToken.stop_requested())
        {
            break;
        }

        try
        {
            ProcessIncomingMessage(gateway_.Receive(), false);
            reconnectAttempt_ = 0;
        }
        catch (const std::exception& receiveError)
        {
            lila::shared::logging::LogWarning(
                "Chat",
                lila::shared::errors::WithDetails(
                    lila::shared::errors::ChatReconnecting,
                    receiveError.what()));
            if (stopToken.stop_requested())
            {
                break;
            }

            SetState(domain::ChatState::Reconnecting);
            SetStatus(lila::shared::errors::ChatReconnecting, false);

            while (!stopToken.stop_requested())
            {
                if (WaitForDelay(stopToken, ResolveReconnectDelay(reconnectAttempt_)))
                {
                    return;
                }

                try
                {
                    gateway_.Close();
                    gateway_.Open(sessionStore_.Current().token, shared::config::AppConfig::ResolveClientVersion());
                    SetState(domain::ChatState::Connected);
                    SetStatus(lila::shared::errors::ChatReconnected, false);
                    reconnectAttempt_ = 0;
                    break;
                }
                catch (const lila::shared::network::http::WsTicketRequestError& reconnectError)
                {
                    SetState(domain::ChatState::Error);
                    sessionStore_.Clear();
                    SetStatus(
                        std::string(lila::shared::errors::ChatReconnectionInterrupted)
                        + " " + lila::shared::errors::ChatReconnectionTicketRejected
                        + " " + std::to_string(reconnectError.StatusCode())
                        + ").",
                        true);
                    return;
                }
                catch (const std::exception& reconnectError)
                {
                    ++reconnectAttempt_;
                    lila::shared::logging::LogWarning(
                        "Chat",
                        lila::shared::errors::WithDetails(
                            lila::shared::errors::ChatReconnectionInterrupted,
                            reconnectError.what()));
                    SetState(domain::ChatState::Reconnecting);
                    SetStatus(lila::shared::errors::ChatReconnecting, false);
                }
            }
        }
    }
}

void ChatService::SendRawJson(const std::string& payload)
{
    if (State() != domain::ChatState::Connected)
    {
        throw std::runtime_error(lila::shared::errors::ChatNotConnected);
    }

    lila::shared::logging::LogDebug(
        "Chat",
        "Envoi d'une trame WebSocket de " + std::to_string(payload.size()) + " octets.");
    gateway_.Send(payload);
    lila::shared::logging::LogDebug(
        "Chat",
        "WinHttpWebSocketSend a accepté la trame (sans accusé de réception applicatif).");
}
}
