#include "modules/chat/application/ChatService.h"

#include <stdexcept>
#include <string>
#include <thread>

#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/network/http/WsTicketProvider.h"
#include "shared/config/AppConfig.h"
#include "shared/contracts/BackendWsContracts.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::chat::application
{
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
            messagesStore_.LoadHistory({}, lila::shared::contracts::chat::DefaultHistoryLoadLimit);
            lastServerError_.reset();
            stopRequested_ = false;
        }

        SetState(domain::ChatState::Connecting);
        SetStatus(lila::shared::errors::ChatConnecting, false);

        gateway_.Open(sessionStore_.Current().token, shared::config::AppConfig::ResolveClientVersion());
        SetStatus(lila::shared::errors::ChatAuthenticating, false);
        SetState(domain::ChatState::Connected);

        SetStatus(lila::shared::errors::ChatLoadingData, false);
        ProcessIncomingMessage(gateway_.Receive());
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
        SetStatus(lila::shared::errors::WithDetails(lila::shared::errors::ChatConnectionFailed, exception.what()), true);
        Close();
        return false;
    }
}

void ChatService::Close()
{
    bool shouldNotifyClosed = true;
    {
        std::scoped_lock lock(mutex_);
        shouldNotifyClosed = state_ != domain::ChatState::Error;
        stopRequested_ = true;
        messagesStore_.Clear();
    }

    gateway_.Close();

    if (receiveThread_.joinable())
    {
        receiveThread_.join();
    }

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
        SetStatus(lila::shared::errors::WithDetails(lila::shared::errors::ChatSendFailed, exception.what()), true);
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
        SetStatus(lila::shared::errors::WithDetails(lila::shared::errors::ChatEditFailed, exception.what()), true);
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
        SetStatus(lila::shared::errors::WithDetails(lila::shared::errors::ChatDeleteFailed, exception.what()), true);
    }
}

void ChatService::StartReceiveLoop()
{
    receiveThread_ = std::thread(
        [this]()
        {
            ReceiveLoop();
        });
}

void ChatService::ReceiveLoop()
{
    while (true)
    {
        {
            std::scoped_lock lock(mutex_);
            if (stopRequested_)
            {
                break;
            }
        }

        try
        {
            ProcessIncomingMessage(gateway_.Receive());
        }
        catch (const std::exception& exception)
        {
            {
                std::scoped_lock lock(mutex_);
                if (stopRequested_)
                {
                    break;
                }
            }

            SetState(domain::ChatState::Reconnecting);
            SetStatus(lila::shared::errors::ChatReconnecting, false);
            try
            {
                gateway_.Close();
                gateway_.Open(sessionStore_.Current().token, shared::config::AppConfig::ResolveClientVersion());
                SetState(domain::ChatState::Connected);
                SetStatus(lila::shared::errors::ChatReconnected, false);
                continue;
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
                break;
            }
            catch (const std::exception& reconnectError)
            {
                SetState(domain::ChatState::Error);
                SetStatus(lila::shared::errors::WithDetails(
                    lila::shared::errors::ChatReconnectionInterrupted,
                    reconnectError.what()),
                    true);
                break;
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

    gateway_.Send(payload);
}
}
