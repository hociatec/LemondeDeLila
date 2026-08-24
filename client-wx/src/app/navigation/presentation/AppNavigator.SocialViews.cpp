#include "app/navigation/presentation/AppNavigator.h"

#include <utility>

#include "app/navigation/presentation/HostFrame.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/presence/presentation/PresenceFrame.h"
#include "modules/social/presentation/SocialFrame.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
using domain::ViewId;

wxWindow* AppNavigator::CreateSocialView(ViewId viewId)
{
    switch (viewId)
    {
    case ViewId::Chat:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Chat): constructing ChatFrame view.");
        return new modules::chat::presentation::ChatFrame(
            hostFrame_->ContentParent(),
            chatService_,
            optionsStore_,
            sessionStore_,
            [this]() { ShowSession(lastMainMenuSelection_); },
            [this]() { CloseApplication(); });
    case ViewId::Messaging:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Messaging): constructing MessagingFrame view.");
        return new modules::messaging::presentation::MessagingFrame(
            hostFrame_->ContentParent(),
            messagingService_,
            [this]()
            {
                if (messagingOpenedFromSocial_)
                {
                    ShowSocial(lastMainMenuSelection_, lastSocialMenuSelection_);
                    return;
                }
                ShowSession(lastMainMenuSelection_);
            },
            [this]() { CloseApplication(); });
    case ViewId::Social:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Social): constructing SocialFrame view.");
        return new modules::social::presentation::SocialFrame(
            hostFrame_->ContentParent(),
            socialService_,
            [this](std::size_t selectedMenuIndex) { ShowMessagingFromSocial(selectedMenuIndex); },
            [this](int userId, std::string username)
            {
                ShowUserStoryBook(userId, std::move(username), ViewId::Social);
            },
            [this]() { ShowSession(lastMainMenuSelection_); },
            [this]() { CloseApplication(); },
            lastSocialMenuSelection_);
    case ViewId::Presence:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Presence): constructing PresenceFrame view.");
        return new modules::presence::presentation::PresenceFrame(
            hostFrame_->ContentParent(),
            presenceMonitor_,
            socialService_,
            messagingService_,
            sessionStore_,
            [this](int userId, std::string username)
            {
                ShowUserStoryBook(userId, std::move(username), ViewId::Presence);
            },
            [this]() { ReplaceView(previousViewBeforePresence_, GetOrCreateView(previousViewBeforePresence_)); },
            [this]() { CloseApplication(); });
    default:
        return nullptr;
    }
}
}
