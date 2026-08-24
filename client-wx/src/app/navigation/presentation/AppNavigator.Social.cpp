#include "app/navigation/presentation/AppNavigator.h"

#include "modules/chat/presentation/ChatFrame.h"
#include "modules/presence/presentation/PresenceFrame.h"
#include "modules/session/application/SessionStore.h"

namespace lila::app::navigation
{
using domain::ViewId;

void AppNavigator::ShowChat(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    messagingOpenedFromSocial_ = false;
    auto* view = GetOrCreateView(ViewId::Chat);
    focusTransition_.Forget(view);
    if (auto* chat = dynamic_cast<modules::chat::presentation::ChatFrame*>(view))
    {
        chat->ResetFocusToComposer();
    }
    ReplaceView(ViewId::Chat, view);
}

void AppNavigator::ShowMessagingFromSocial(std::size_t socialMenuIndex)
{
    lastSocialMenuSelection_ = socialMenuIndex;
    messagingOpenedFromSocial_ = true;
    ReplaceView(ViewId::Messaging, GetOrCreateView(ViewId::Messaging));
}

void AppNavigator::ShowMessaging(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    messagingOpenedFromSocial_ = false;
    ReplaceView(ViewId::Messaging, GetOrCreateView(ViewId::Messaging));
}

void AppNavigator::ShowSocial(std::size_t selectedIndex, std::size_t socialMenuIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    lastSocialMenuSelection_ = socialMenuIndex;
    messagingOpenedFromSocial_ = false;
    ReplaceView(ViewId::Social, GetOrCreateView(ViewId::Social));
}

void AppNavigator::ShowPresence()
{
    if (!sessionStore_.HasActiveSession() || currentViewId_ == ViewId::Home || currentViewId_ == ViewId::None)
    {
        return;
    }
    if (currentViewId_ == ViewId::Presence)
    {
        return;
    }

    previousViewBeforePresence_ = currentViewId_;
    auto* view = GetOrCreateView(ViewId::Presence);
    if (auto* presence = dynamic_cast<modules::presence::presentation::PresenceFrame*>(view))
    {
        presence->ResetForOpen();
    }
    ReplaceView(ViewId::Presence, view);
}

void AppNavigator::ShowAbout(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    ReplaceView(ViewId::About, GetOrCreateView(ViewId::About));
}

void AppNavigator::ShowOptions(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    ReplaceView(ViewId::Options, GetOrCreateView(ViewId::Options));
}
}
