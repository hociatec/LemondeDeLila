#include "app/navigation/presentation/AppNavigator.h"

#include "app/navigation/presentation/HostFrame.h"
#include "modules/about/presentation/AboutFrame.h"
#include "modules/chat/application/ChatService.h"
#include "modules/home/presentation/HomeFrame.h"
#include "modules/main_menu/presentation/MainMenuFrame.h"
#include "modules/options/presentation/OptionsFrame.h"
#include "shared/logging/application/Logger.h"

namespace lila::app::navigation
{
using domain::ViewId;

wxWindow* AppNavigator::CreateView(ViewId viewId)
{
    if (hostFrame_ == nullptr)
    {
        return nullptr;
    }
    if (auto* view = CreateCoreView(viewId))
    {
        return view;
    }
    if (auto* view = CreateGameView(viewId))
    {
        return view;
    }
    return CreateSocialView(viewId);
}

wxWindow* AppNavigator::CreateCoreView(ViewId viewId)
{
    switch (viewId)
    {
    case ViewId::Home:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Home): constructing HomeFrame view.");
        return new modules::home::presentation::HomeFrame(
            hostFrame_->ContentParent(),
            loginUseCase_,
            registerUseCase_,
            [this](const modules::user::domain::AuthenticationResult& result)
            {
                OnLoginSucceeded(result);
            });
    case ViewId::MainMenu:
        lila::shared::logging::LogInfo("Navigator", "CreateView(MainMenu): constructing MainMenuFrame view.");
        return new modules::main_menu::presentation::MainMenuFrame(
            hostFrame_->ContentParent(),
            sessionStore_,
            optionsStore_,
            [this](std::size_t menuIndex) { ShowCatalog(menuIndex); },
            [this](std::size_t menuIndex) { ShowAbout(menuIndex); },
            [this](std::size_t menuIndex) { ShowChat(menuIndex); },
            [this](std::size_t menuIndex) { ShowSocial(menuIndex); },
            [this](std::size_t menuIndex) { ShowOptions(menuIndex); },
            [this](std::size_t menuIndex) { OnLogoutRequested(menuIndex); },
            lastMainMenuSelection_);
    case ViewId::About:
        lila::shared::logging::LogInfo("Navigator", "CreateView(About): constructing AboutFrame view.");
        return new modules::about::presentation::AboutFrame(
            hostFrame_->ContentParent(),
            sessionStore_,
            [this]() { ShowSession(lastMainMenuSelection_); },
            [this]() { CloseApplication(); });
    case ViewId::Options:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Options): constructing OptionsFrame view.");
        return new modules::options::presentation::OptionsFrame(
            hostFrame_->ContentParent(),
            optionsStore_,
            [this]()
            {
                chatService_.Close();
                ResetView(ViewId::Chat);
                ShowSession(lastMainMenuSelection_);
            });
    default:
        return nullptr;
    }
}
}
