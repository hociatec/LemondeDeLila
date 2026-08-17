#include "app/navigation/AppNavigator.h"

#include <wx/app.h>
#include <wx/frame.h>
#include <wx/msgdlg.h>

#include "modules/about/presentation/AboutFrame.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/home/presentation/HomeFrame.h"
#include "modules/main_menu/presentation/MainMenuFrame.h"
#include "modules/messaging/application/MessagingService.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/presentation/OptionsFrame.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/Session.h"
#include "modules/social/application/SocialService.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"

namespace lila::app::navigation
{
AppNavigator::AppNavigator(
    modules::user::application::LoginUseCase& loginUseCase,
    modules::user::application::RegisterUseCase& registerUseCase,
    modules::session::application::SessionStore& sessionStore,
    modules::options::application::OptionsStore& optionsStore,
    modules::chat::application::ChatService& chatService,
    modules::messaging::application::MessagingService& messagingService,
    modules::social::application::SocialService& socialService)
    : loginUseCase_(loginUseCase),
      registerUseCase_(registerUseCase),
      sessionStore_(sessionStore),
      optionsStore_(optionsStore),
      chatService_(chatService),
      messagingService_(messagingService),
      socialService_(socialService)
{
}

bool AppNavigator::Start()
{
    if (optionsStore_.Current().restoreSessionOnStartup && sessionStore_.Restore())
    {
        ShowSession();
        return true;
    }

    sessionStore_.SyncPersistence(false);
    ShowHome();
    return true;
}

void AppNavigator::ShowHome()
{
    auto* window = new modules::home::presentation::HomeFrame(
        loginUseCase_,
        registerUseCase_,
        [this](const modules::user::domain::AuthenticationResult& result)
        {
            OnLoginSucceeded(result);
        });
    ReplaceWindow(window);
}

void AppNavigator::ShowSession(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    if (!sessionStore_.HasActiveSession())
    {
        ShowHome();
        return;
    }

    auto* window = new modules::main_menu::presentation::MainMenuFrame(
        sessionStore_,
        optionsStore_,
        [this](std::size_t menuIndex)
        {
            ShowAbout(menuIndex);
        },
        [this](std::size_t menuIndex)
        {
            ShowChat(menuIndex);
        },
        [this](std::size_t menuIndex)
        {
            ShowSocial(menuIndex);
        },
        [this](std::size_t menuIndex)
        {
            ShowOptions(menuIndex);
        },
        [this](std::size_t menuIndex)
        {
            OnLogoutRequested(menuIndex);
        },
        lastMainMenuSelection_);
    ReplaceWindow(window);
}

void AppNavigator::ShowChat(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    auto* window = new modules::chat::presentation::ChatFrame(
        chatService_,
        optionsStore_,
        [this]()
        {
            ShowSession(lastMainMenuSelection_);
        },
        [this]()
        {
            CloseApplication();
        });
    ReplaceWindow(window);
}

void AppNavigator::ShowMessagingFromSocial(std::size_t socialMenuIndex)
{
    lastSocialMenuSelection_ = socialMenuIndex;

    auto* window = new modules::messaging::presentation::MessagingFrame(
        messagingService_,
        [this]()
        {
            ShowSocial(lastMainMenuSelection_, lastSocialMenuSelection_);
        },
        [this]()
        {
            CloseApplication();
        });
    ReplaceWindow(window);
}

void AppNavigator::ShowMessaging(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    auto* window = new modules::messaging::presentation::MessagingFrame(
        messagingService_,
        [this]()
        {
            ShowSession(lastMainMenuSelection_);
        },
        [this]()
        {
            CloseApplication();
        });
    ReplaceWindow(window);
}

void AppNavigator::ShowSocial(std::size_t selectedIndex, std::size_t socialMenuIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    lastSocialMenuSelection_ = socialMenuIndex;

    auto* window = new modules::social::presentation::SocialFrame(
        socialService_,
        [this](std::size_t selectedMenuIndex)
        {
            ShowMessagingFromSocial(selectedMenuIndex);
        },
        [this]()
        {
            ShowSession(lastMainMenuSelection_);
        },
        [this]()
        {
            CloseApplication();
        },
        lastSocialMenuSelection_);
    ReplaceWindow(window);
}

void AppNavigator::ShowAbout(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    auto* window = new modules::about::presentation::AboutFrame(
        sessionStore_,
        [this]()
        {
            ShowSession(lastMainMenuSelection_);
        },
        [this]()
        {
            CloseApplication();
        });
    ReplaceWindow(window);
}

void AppNavigator::ShowOptions(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    auto* window = new modules::options::presentation::OptionsFrame(
        optionsStore_,
        sessionStore_,
        [this]()
        {
            ShowSession(lastMainMenuSelection_);
        },
        [this]()
        {
            CloseApplication();
        });
    ReplaceWindow(window);
}

void AppNavigator::CloseApplication()
{
    currentWindow_ = nullptr;

    if (wxTheApp != nullptr)
    {
        wxTheApp->ExitMainLoop();
    }
}

void AppNavigator::ReplaceWindow(wxFrame* nextWindow)
{
    wxFrame* windowToReplace = currentWindow_;
    currentWindow_ = nextWindow;

    if (currentWindow_ != nullptr)
    {
        currentWindow_->Show(true);
        currentWindow_->Raise();
    }

    if (windowToReplace != nullptr)
    {
        windowToReplace->Destroy();
    }
}

void AppNavigator::OnLoginSucceeded(const modules::user::domain::AuthenticationResult& result)
{
    modules::session::domain::Session session;
    session.userId = result.userId;
    session.username = result.username;
    session.token = result.token;
    sessionStore_.Open(std::move(session), result.rememberSession && optionsStore_.Current().restoreSessionOnStartup);
    ShowSession();
}

void AppNavigator::OnLogoutRequested(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    sessionStore_.Clear();
    ShowHome();
}
}

