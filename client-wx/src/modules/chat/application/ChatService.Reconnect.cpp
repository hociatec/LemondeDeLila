#include "modules/chat/application/ChatService.h"

#include <algorithm>
#include <chrono>
#include <string>
#include <thread>

#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/http/IWsTicketProvider.h"

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
                    OpenGateway(stopToken);
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
}
