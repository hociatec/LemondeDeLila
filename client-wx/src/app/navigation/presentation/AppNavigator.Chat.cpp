#include "app/navigation/presentation/AppNavigator.h"

#include <algorithm>
#include <chrono>
#include <thread>

#include <wx/weakref.h>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/domain/ChatState.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/session/application/SessionStore.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
void AppNavigator::StartSessionChat()
{
    if (!sessionStore_.HasActiveSession() || !optionsStore_.Current().chat.chatEnabled)
    {
        StopSessionChat();
        return;
    }

    const auto state = chatService_.State();
    if (state == modules::chat::domain::ChatState::Connected
        || state == modules::chat::domain::ChatState::Connecting
        || state == modules::chat::domain::ChatState::Reconnecting
        || chatStartupTask_ != nullptr)
    {
        return;
    }

    auto* service = &chatService_;
    auto* sessionStore = &sessionStore_;
    const wxWeakRef<HostFrame> weakFrame(hostFrame_);
    chatStartupTask_ = lila::shared::concurrency::RunAsync(
        [service, sessionStore](std::stop_token stopToken)
        {
            auto retryDelay = std::chrono::milliseconds(500);
            while (!stopToken.stop_requested() && sessionStore->HasActiveSession())
            {
                if (service->Open()) return;
                constexpr auto pollStep = std::chrono::milliseconds(100);
                auto remaining = retryDelay;
                while (!stopToken.stop_requested() && remaining.count() > 0)
                {
                    const auto delay = std::min(pollStep, remaining);
                    std::this_thread::sleep_for(delay);
                    remaining -= delay;
                }
                retryDelay = std::min(retryDelay * 2, std::chrono::milliseconds(3000));
            }
        },
        [this, weakFrame](std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakFrame) return;
            weakFrame->CallAfter(
                [this, weakFrame, error = std::move(error)]()
                {
                    if (!weakFrame) return;
                    chatStartupTask_.reset();
                    if (error.has_value())
                    {
                        lila::shared::logging::LogWarning(
                            "Chat",
                            "Le démarrage persistant du tchat a échoué.");
                    }
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::High,
        lila::shared::errors::ChatConnectionFailed);
}

void AppNavigator::StopSessionChat()
{
    if (chatStartupTask_ != nullptr)
    {
        chatStartupTask_->RequestCancel();
        chatStartupTask_.reset();
    }
    chatService_.Close();
}
}
