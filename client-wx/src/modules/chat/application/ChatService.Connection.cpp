#include "modules/chat/application/ChatService.h"

#include <stdexcept>
#include <string>

#include "modules/chat/infrastructure/ChatProtocol.h"
#include "modules/chat/infrastructure/ChatProtocolFields.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "modules/audio/application/IAudioService.h"

namespace lila::modules::chat::application
{
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

    if (!sessionStore_.HasActiveSession())
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

        OpenGateway();
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

void ChatService::OpenGateway(std::stop_token stopToken)
{
    const auto open = [this](const std::string& token)
    {
        gateway_.Open(token, shared::config::AppConfig::ResolveClientVersion());
    };

    try
    {
        open(sessionStore_.AccessToken(stopToken));
    }
    catch (const lila::shared::network::http::WsTicketRequestError& exception)
    {
        if ((exception.StatusCode() != 401 && exception.StatusCode() != 403)
            || stopToken.stop_requested())
        {
            throw;
        }
        gateway_.Close();
        open(sessionStore_.RefreshAccessToken(stopToken));
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
        audioService_.Play(lila::modules::audio::domain::SoundCue::ChatMessageSent);
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

void ChatService::SendRawJson(const std::string& payload)
{
    gateway_.Send(payload);
}
}
