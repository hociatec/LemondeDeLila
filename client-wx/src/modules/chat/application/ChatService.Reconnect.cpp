#include "modules/chat/application/ChatService.h"

#include <chrono>
#include <string>

#include "modules/session/application/SessionStore.h"
#include "shared/config/domain/AppConfig.h"
#include "modules/chat/domain/ChatErrorMessages.h"
#include "shared/errors/domain/ErrorFormatting.h"
#include "shared/logging/application/Logger.h"
#include "shared/network/application/http/IWsTicketProvider.h"
#include "shared/network/application/realtime/ReconnectPolicy.h"

namespace lila::modules::chat::application
{
namespace
{
shared::network::realtime::ReconnectPolicyOptions ReconnectOptions()
{
    const int initialDelayMs = std::max(1, lila::shared::config::AppConfig::ResolveChatReconnectInitialDelayMs());
    const int maxDelayMs = std::max(initialDelayMs, lila::shared::config::AppConfig::ResolveChatReconnectMaxDelayMs());

    return {std::chrono::milliseconds(initialDelayMs),
            std::chrono::milliseconds(maxDelayMs), 0.2};
}

bool IsAuthenticationRejection(unsigned long statusCode)
{
    return statusCode == 401 || statusCode == 403;
}
}

void ChatService::StartReceiveLoop(std::uint64_t lifecycleGeneration)
{
    receiveTask_ = lila::shared::concurrency::RunAsync(
        [this, lifecycleGeneration](std::stop_token stopToken)
        {
            ReceiveLoop(stopToken, lifecycleGeneration);
        },
        {},
        lila::shared::concurrency::BackgroundTaskPriority::High,
        lila::shared::errors::ChatReconnectionInterrupted);
}

void ChatService::ReceiveLoop(
    std::stop_token stopToken,
    std::uint64_t lifecycleGeneration)
{
    shared::network::realtime::ReconnectPolicy reconnectPolicy(ReconnectOptions());
    while (true)
    {
        if (stopToken.stop_requested() || !IsLifecycleCurrent(lifecycleGeneration))
        {
            break;
        }

        try
        {
            ProcessIncomingMessage(gateway_.Receive(), false);
            reconnectPolicy.Reset();
        }
        catch (const std::exception& receiveError)
        {
            if (stopToken.stop_requested() || !IsLifecycleCurrent(lifecycleGeneration))
            {
                break;
            }
            lila::shared::logging::LogWarning(
                "Chat",
                lila::shared::errors::WithDetails(
                    lila::shared::errors::ChatReconnecting,
                    receiveError.what()));
            SetState(domain::ChatState::Reconnecting);
            SetStatus(lila::shared::errors::ChatReconnecting, false);

            while (!stopToken.stop_requested() && IsLifecycleCurrent(lifecycleGeneration))
            {
                if (shared::network::realtime::WaitForCancellation(
                        stopToken, reconnectPolicy.NextDelay()))
                {
                    return;
                }

                try
                {
                    gateway_.Close();
                    OpenGateway(stopToken);
                    SetState(domain::ChatState::Connected);
                    SetStatus(lila::shared::errors::ChatReconnected, false);
                    reconnectPolicy.Reset();
                    break;
                }
                catch (const lila::shared::network::http::WsTicketRequestError& reconnectError)
                {
                    if (IsAuthenticationRejection(reconnectError.StatusCode()))
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

                    lila::shared::logging::LogWarning(
                        "Chat",
                        lila::shared::errors::WithDetails(
                            lila::shared::errors::ChatReconnectionInterrupted,
                            reconnectError.what()));
                    SetState(domain::ChatState::Reconnecting);
                    SetStatus(lila::shared::errors::ChatReconnecting, false);
                }
                catch (const std::exception& reconnectError)
                {
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
