#include "app/navigation/AppNavigator.h"

#include <wx/app.h>
#include <wx/frame.h>
#include <wx/msgdlg.h>
#include <wx/weakref.h>
#include <wx/window.h>

#include <exception>

#include "app/navigation/HostFrame.h"
#include "modules/about/presentation/AboutFrame.h"
#include "modules/catalog/application/CatalogService.h"
#include "modules/catalog/presentation/CatalogPanel.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "modules/rooms/presentation/JoinRoomsPanel.h"
#include "modules/rooms/presentation/RoomPanel.h"
#include "modules/vault/application/VaultService.h"
#include "modules/vault/presentation/VaultPanel.h"
#include "modules/storybook/application/StoryBookService.h"
#include "modules/storybook/presentation/StoryBookPanel.h"
#include "modules/leaderboard/application/LeaderboardService.h"
#include "modules/leaderboard/presentation/LeaderboardPanel.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/home/presentation/HomeFrame.h"
#include "modules/main_menu/presentation/MainMenuFrame.h"
#include "modules/messaging/application/MessagingService.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/options/presentation/OptionsFrame.h"
#include "modules/presence/application/PresenceMonitor.h"
#include "modules/presence/presentation/PresenceFrame.h"
#include "modules/session/application/SessionStore.h"
#include "modules/session/domain/Session.h"
#include "modules/social/application/SocialService.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/user/application/LoginUseCase.h"
#include "modules/user/application/RegisterUseCase.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/FocusCoordinator.h"
#include "shared/accessibility/FocusPlanView.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/concurrency/BackgroundExecutor.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"

namespace lila::app::navigation
{
namespace
{
using ViewId = lila::app::navigation::detail::ViewId;
constexpr int WindowAnnouncementFocusDelayMilliseconds = 300;
}

AppNavigator::AppNavigator(
    AuthNavigationDependencies auth,
    GameNavigationDependencies game,
    SocialNavigationDependencies social)
    : loginUseCase_(auth.loginUseCase),
      registerUseCase_(auth.registerUseCase),
      sessionStore_(auth.sessionStore),
      optionsStore_(auth.optionsStore),
      catalogService_(game.catalogService),
      roomLobbyService_(game.roomLobbyService),
      roomSessionService_(game.roomSessionService),
      vaultService_(game.vaultService),
      storyBookService_(game.storyBookService),
      leaderboardService_(game.leaderboardService),
      chatService_(social.chatService),
      messagingService_(social.messagingService),
      socialService_(social.socialService),
      presenceMonitor_(social.presenceMonitor)
{
}

bool AppNavigator::Start()
{
    lila::shared::logging::LogInfo("Navigator", "Start() begin.");
    if (hostFrame_ == nullptr)
    {
        hostFrame_ = new HostFrame();
        hostFrame_->SetPresenceRequestedHandler([this]() { ShowPresence(); });
        if (wxTheApp != nullptr)
        {
            wxTheApp->SetTopWindow(hostFrame_);
        }
    }

    lila::shared::logging::LogInfo(
        "Navigator",
        std::string("restoreSessionOnStartup=") + (optionsStore_.Current().restoreSessionOnStartup ? "true" : "false"));
    if (optionsStore_.Current().restoreSessionOnStartup)
    {
        try
        {
            if (sessionStore_.Restore())
            {
                lila::shared::logging::LogInfo("Navigator", "Stored session restored. Opening main menu.");
                ShowSession(0, InitialFocusTiming::AfterWindowAnnouncement);
                return true;
            }
        }
        catch (const std::exception& error)
        {
            lila::shared::logging::LogWarning(
                "Navigator",
                std::string("Stored session restore failed. Clearing invalid session and opening home. ") + error.what());
            sessionStore_.Clear();
        }
    }

    lila::shared::logging::LogInfo("Navigator", "No stored session restored. Opening home.");
    ShowHome();
    return true;
}

void AppNavigator::ShowHome(InitialFocusTiming focusTiming)
{
    auto* view = GetOrCreateView(ViewId::Home);
    if (focusTiming != InitialFocusTiming::Immediate) focusTransition_.Forget(view);
    ReplaceView(ViewId::Home, view, focusTiming);
}

void AppNavigator::ShowSession(std::size_t selectedIndex, InitialFocusTiming focusTiming)
{
    lila::shared::logging::LogInfo("Navigator", "ShowSession(): begin.");
    lastMainMenuSelection_ = selectedIndex;
    if (!sessionStore_.HasActiveSession())
    {
        lila::shared::logging::LogWarning("Navigator", "ShowSession(): no active session, fallback to home.");
        ShowHome();
        return;
    }

    presenceMonitor_.Start();
    auto* view = GetOrCreateView(ViewId::MainMenu);
    if (focusTiming != InitialFocusTiming::Immediate) focusTransition_.Forget(view);
    ReplaceView(ViewId::MainMenu, view, focusTiming);
    PrewarmSessionData();
    PrewarmSessionViews();
}

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

void AppNavigator::ShowCatalog(std::size_t selectedIndex)
{
    lastMainMenuSelection_ = selectedIndex;
    ReplaceView(ViewId::Catalog, GetOrCreateView(ViewId::Catalog));
}

void AppNavigator::ShowJoinRooms()
{
    auto* view = GetOrCreateView(ViewId::JoinRooms);
    ReplaceView(ViewId::JoinRooms, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::JoinRoomsPanel*>(view))
    {
        panel->Prepare({});
    }
}

void AppNavigator::ShowVault()
{
    auto* view = GetOrCreateView(ViewId::Vault);
    if (resetVaultFocusOnNextOpen_)
    {
        focusTransition_.Forget(view);
        if (auto* panel = dynamic_cast<modules::vault::presentation::VaultPanel*>(view))
        {
            panel->ResetSelectionForNextPrepare();
        }
        resetVaultFocusOnNextOpen_ = false;
    }
    ReplaceView(ViewId::Vault, view);
    if (auto* panel = dynamic_cast<modules::vault::presentation::VaultPanel*>(view))
    {
        panel->Prepare({});
    }
}

void AppNavigator::CreateRoom(const modules::catalog::domain::CatalogGame& game)
{
    auto* view = GetOrCreateView(ViewId::Room);
    ReplaceView(ViewId::Room, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::RoomPanel*>(view))
    {
        panel->PrepareCreate(
            game.id,
            game.name,
            game.summary,
            game.engine,
            game.minPlayers,
            game.maxPlayers,
            {});
    }
}

void AppNavigator::JoinRoom(int roomId, bool spectator)
{
    const auto sourceView = currentViewId_;
    auto* view = GetOrCreateView(ViewId::Room);
    ReplaceView(ViewId::Room, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::RoomPanel*>(view))
    {
        panel->PrepareJoin(
            roomId,
            spectator,
            [this, sourceView]()
            {
                if (currentViewId_ != ViewId::Room && currentViewId_ != sourceView)
                {
                    roomSessionService_.Leave();
                }
            });
    }
}

void AppNavigator::RestoreRoom(int roomId)
{
    const auto sourceView = currentViewId_;
    auto* view = GetOrCreateView(ViewId::Room);
    ReplaceView(ViewId::Room, view);
    if (auto* panel = dynamic_cast<modules::rooms::presentation::RoomPanel*>(view))
    {
        panel->PrepareRestore(
            roomId,
            [this, sourceView]()
            {
                if (currentViewId_ != ViewId::Room && currentViewId_ != sourceView)
                    roomSessionService_.Leave();
            });
    }
}

void AppNavigator::ShowOwnStoryBook()
{
    storyBookReturnView_ = ViewId::Catalog;
    auto* view = GetOrCreateView(ViewId::StoryBook);
    if (auto* panel = dynamic_cast<modules::storybook::presentation::StoryBookPanel*>(view))
    {
        panel->OpenOwn();
    }
    ReplaceView(ViewId::StoryBook, view);
}

void AppNavigator::ShowUserStoryBook(int userId, std::string username, ViewId returnView)
{
    storyBookReturnView_ = returnView;
    auto* view = GetOrCreateView(ViewId::StoryBook);
    if (auto* panel = dynamic_cast<modules::storybook::presentation::StoryBookPanel*>(view))
    {
        panel->OpenUser(userId, std::move(username));
    }
    ReplaceView(ViewId::StoryBook, view);
}

void AppNavigator::ShowLeaderboard()
{
    auto* view = GetOrCreateView(ViewId::Leaderboard);
    if (auto* panel = dynamic_cast<modules::leaderboard::presentation::LeaderboardPanel*>(view))
    {
        panel->Prepare(
            [this, view]()
            {
                if (currentViewId_ == ViewId::StoryBook)
                {
                    ReplaceView(ViewId::Leaderboard, view);
                }
            });
    }
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
    if (auto* presence = dynamic_cast<modules::presence::presentation::PresenceFrame*>(GetOrCreateView(ViewId::Presence)))
    {
        presence->ResetForOpen();
    }
    ReplaceView(ViewId::Presence, GetOrCreateView(ViewId::Presence));
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

void AppNavigator::CloseApplication()
{
    presenceMonitor_.Stop();
    if (hostFrame_ != nullptr) hostFrame_->Hide();
    if (currentLegacyWindow_ != nullptr) currentLegacyWindow_->Hide();
    ResetSessionViews();
    ResetView(ViewId::Home);
    currentViewId_ = ViewId::None;
    currentView_ = nullptr;
    currentLegacyWindow_ = nullptr;

    if (hostFrame_ != nullptr)
    {
        hostFrame_->Destroy();
        hostFrame_ = nullptr;
    }

    if (wxTheApp != nullptr)
    {
        wxTheApp->ExitMainLoop();
    }
}

void AppNavigator::PrewarmSessionData()
{
    if (sessionDataPrewarmed_)
    {
        return;
    }

    sessionDataPrewarmed_ = true;
    auto* service = &catalogService_;
    catalogPrewarmTask_ = lila::shared::concurrency::RunAsync(
        [service](std::stop_token stopToken)
        {
            static_cast<void>(service->LoadShelves(stopToken));
        },
        [](std::optional<lila::shared::errors::AppError> error)
        {
            if (error.has_value())
            {
                lila::shared::logging::LogWarning("Catalog", "Background cache prewarm failed.");
            }
        },
        lila::shared::concurrency::BackgroundTaskPriority::Low,
        lila::shared::errors::CatalogLoadFailed);
}

void AppNavigator::PrewarmSessionViews()
{
    if (sessionViewsPrewarmed_ || hostFrame_ == nullptr)
    {
        return;
    }

    sessionViewsPrewarmed_ = true;
    hostFrame_->CallAfter(
        [this]()
        {
            if (hostFrame_ == nullptr || currentViewId_ != ViewId::MainMenu)
            {
                return;
            }

            suppressFocusRememberOnViewCreation_ = true;
            static_cast<void>(GetOrCreateView(ViewId::Social));
            suppressFocusRememberOnViewCreation_ = false;
        });
}

void AppNavigator::ReturnToCatalogAfterRoomClose(bool resetVaultFocus, bool resetCatalogFocus)
{
    resetVaultFocusOnNextOpen_ = resetVaultFocus;
    auto* view = GetOrCreateView(ViewId::Catalog);
    if (resetCatalogFocus)
    {
        focusTransition_.Forget(view);
        if (auto* panel = dynamic_cast<modules::catalog::presentation::CatalogPanel*>(view))
        {
            panel->ResetToRootForNextShow();
        }
    }
    ReplaceView(ViewId::Catalog, view);
}

void AppNavigator::ReplaceView(ViewId nextViewId, wxWindow* nextView, InitialFocusTiming focusTiming)
{
    lila::shared::logging::LogInfo("Navigator", "ReplaceView(): begin.");
    if (currentView_ != nullptr && currentView_ != nextView)
    {
        focusTransition_.Remember(currentView_);
    }
    currentViewId_ = nextViewId;
    currentView_ = nextView;

    if (currentLegacyWindow_ != nullptr)
    {
        currentLegacyWindow_->Enable(false);
        currentLegacyWindow_->Show(false);
    }

    if (hostFrame_ == nullptr)
    {
        return;
    }

    const bool hostWasShown = hostFrame_->IsShown();
    hostFrame_->SetContent(currentView_);
    if (!hostWasShown)
    {
        hostFrame_->Show(true);
    }
    wxWeakRef<wxWindow> weakInitialView(currentView_);
    auto applyInitialFocus = [this, weakInitialView]()
    {
        wxWindow* initialView = weakInitialView.get();
        if (initialView != nullptr &&
            !lila::shared::accessibility::NavigationController::IsDescendantOf(
                wxWindow::FindFocus(),
                initialView))
        {
            ApplyViewFocus(initialView);
        }
    };

    if (focusTiming == InitialFocusTiming::AfterWindowAnnouncement)
    {
        hostFrame_->ScheduleContentFocus(
            std::move(applyInitialFocus),
            WindowAnnouncementFocusDelayMilliseconds);
    }
    else if (focusTiming == InitialFocusTiming::NextEventLoop || !hostWasShown)
    {
        lila::shared::accessibility::FocusCoordinator::ScheduleAction(
            *currentView_,
            std::move(applyInitialFocus));
    }
    else
    {
        ApplyViewFocus(currentView_);
    }

    if (currentLegacyWindow_ != nullptr)
    {
        auto* legacyToDestroy = currentLegacyWindow_;
        currentLegacyWindow_ = nullptr;
        legacyToDestroy->Destroy();
    }

}

void AppNavigator::ApplyViewFocus(wxWindow* view)
{
    if (view == nullptr || focusTransition_.Restore(view))
    {
        return;
    }

    if (auto* focusView = dynamic_cast<lila::shared::accessibility::FocusPlanView*>(view))
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusView->BuildFocusPlan()));
    }
}

void AppNavigator::ShowLegacyWindow(wxFrame* nextWindow)
{
    lila::shared::logging::LogInfo("Navigator", "ShowLegacyWindow(): begin.");
    wxFrame* windowToReplace = currentLegacyWindow_;
    currentLegacyWindow_ = nextWindow;

    if (hostFrame_ != nullptr)
    {
        hostFrame_->Show(false);
    }

    if (windowToReplace != nullptr)
    {
        windowToReplace->Enable(false);
        windowToReplace->Show(false);
    }

    if (currentLegacyWindow_ != nullptr)
    {
        currentLegacyWindow_->Show(true);
        currentLegacyWindow_->Raise();
    }

    if (windowToReplace != nullptr && currentLegacyWindow_ != nullptr)
    {
        wxWeakRef<wxFrame> weakWindow(windowToReplace);
        windowToReplace->CallAfter(
            [weakWindow]()
            {
                if (weakWindow)
                {
                    weakWindow->Destroy();
                }
            });
    }
}

void AppNavigator::OnLoginSucceeded(const modules::user::domain::AuthenticationResult& result)
{
    modules::session::domain::Session session;
    session.userId = result.userId;
    session.username = result.username;
    session.token = result.token;
    session.expiresAt = result.expiresAt;
    sessionStore_.Open(std::move(session), result.rememberSession && optionsStore_.Current().restoreSessionOnStartup);
    ShowSession(0, InitialFocusTiming::AfterWindowAnnouncement);
}

void AppNavigator::OnLogoutRequested(std::size_t selectedIndex)
{
    static_cast<void>(selectedIndex);
    lastMainMenuSelection_ = 0;
    messagingOpenedFromSocial_ = false;
    presenceMonitor_.Stop();
    sessionStore_.Clear();
    auto* home = dynamic_cast<modules::home::presentation::HomeFrame*>(GetOrCreateView(ViewId::Home));
    if (home != nullptr)
    {
        home->PrepareForLogout();
    }
    ShowHome(InitialFocusTiming::NextEventLoop);
    ResetSessionViews();
}

wxWindow* AppNavigator::CreateView(ViewId viewId)
{
    if (hostFrame_ == nullptr)
    {
        return nullptr;
    }

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
            [this](std::size_t menuIndex)
            {
                ShowCatalog(menuIndex);
            },
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
    case ViewId::Catalog:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Catalog): constructing CatalogPanel view.");
        return new modules::catalog::presentation::CatalogPanel(
            hostFrame_->ContentParent(),
            catalogService_,
            [this]()
            {
                ShowJoinRooms();
            },
            [this]()
            {
                ShowOwnStoryBook();
            },
            [this]()
            {
                ShowVault();
            },
            [this](const modules::catalog::domain::CatalogGame& game)
            {
                CreateRoom(game);
            },
            [this]()
            {
                ShowSession(lastMainMenuSelection_);
            });
    case ViewId::JoinRooms:
        return new modules::rooms::presentation::JoinRoomsPanel(
            hostFrame_->ContentParent(),
            roomLobbyService_,
            [this](int roomId, bool spectator) { JoinRoom(roomId, spectator); },
            [this]() { ReplaceView(ViewId::Catalog, GetOrCreateView(ViewId::Catalog)); });
    case ViewId::Vault:
        return new modules::vault::presentation::VaultPanel(
            hostFrame_->ContentParent(),
            vaultService_,
            [this](int roomId)
            {
                RestoreRoom(roomId);
            },
            [this]() { ReplaceView(ViewId::Catalog, GetOrCreateView(ViewId::Catalog)); });
    case ViewId::Room:
        return new modules::rooms::presentation::RoomPanel(
            hostFrame_->ContentParent(),
            roomSessionService_,
            [this](int roomId, std::stop_token stopToken)
            {
                return vaultService_.Save(roomId, stopToken);
            },
            [this](int roomId, std::stop_token stopToken)
            {
                vaultService_.Abandon(roomId, stopToken);
            },
            [this]() { ReturnToCatalogAfterRoomClose(true, true); });
    case ViewId::StoryBook:
        lila::shared::logging::LogInfo("Navigator", "CreateView(StoryBook): constructing StoryBookPanel view.");
        return new modules::storybook::presentation::StoryBookPanel(
            hostFrame_->ContentParent(),
            storyBookService_,
            [this]()
            {
                ShowLeaderboard();
            },
            [this]()
            {
                ReplaceView(storyBookReturnView_, GetOrCreateView(storyBookReturnView_));
            });
    case ViewId::Leaderboard:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Leaderboard): constructing LeaderboardPanel view.");
        return new modules::leaderboard::presentation::LeaderboardPanel(
            hostFrame_->ContentParent(),
            leaderboardService_,
            [this]()
            {
                ReplaceView(ViewId::StoryBook, GetOrCreateView(ViewId::StoryBook));
            });
    case ViewId::Chat:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Chat): constructing ChatFrame view.");
        return new modules::chat::presentation::ChatFrame(
            hostFrame_->ContentParent(),
            chatService_,
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
            [this]()
            {
                CloseApplication();
            });
    case ViewId::Social:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Social): constructing SocialFrame view.");
        return new modules::social::presentation::SocialFrame(
            hostFrame_->ContentParent(),
            socialService_,
            [this](std::size_t selectedMenuIndex)
            {
                ShowMessagingFromSocial(selectedMenuIndex);
            },
            [this](int userId, std::string username)
            {
                ShowUserStoryBook(userId, std::move(username), ViewId::Social);
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
            [this]()
            {
                ReplaceView(previousViewBeforePresence_, GetOrCreateView(previousViewBeforePresence_));
            },
            [this]()
            {
                CloseApplication();
            });
    case ViewId::About:
        lila::shared::logging::LogInfo("Navigator", "CreateView(About): constructing AboutFrame view.");
        return new modules::about::presentation::AboutFrame(
            hostFrame_->ContentParent(),
            sessionStore_,
            [this]()
            {
                ShowSession(lastMainMenuSelection_);
            },
            [this]()
            {
                CloseApplication();
            });
    case ViewId::Options:
        lila::shared::logging::LogInfo("Navigator", "CreateView(Options): constructing OptionsFrame view.");
        return new modules::options::presentation::OptionsFrame(
            hostFrame_->ContentParent(),
            optionsStore_,
            [this]()
            {
                ShowSession(lastMainMenuSelection_);
            },
            [this]()
            {
                CloseApplication();
            });
    case ViewId::None:
        break;
    }

    return nullptr;
}

wxWindow* AppNavigator::GetOrCreateView(ViewId viewId)
{
    wxWindow** slot = nullptr;
    switch (viewId)
    {
    case ViewId::Home:
        slot = &homeView_;
        break;
    case ViewId::MainMenu:
        slot = &mainMenuView_;
        break;
    case ViewId::Catalog:
        slot = &catalogView_;
        break;
    case ViewId::JoinRooms:
        slot = &joinRoomsView_;
        break;
    case ViewId::Vault:
        slot = &vaultView_;
        break;
    case ViewId::Room:
        slot = &roomView_;
        break;
    case ViewId::StoryBook:
        slot = &storyBookView_;
        break;
    case ViewId::Leaderboard:
        slot = &leaderboardView_;
        break;
    case ViewId::Chat:
        slot = &chatView_;
        break;
    case ViewId::Messaging:
        slot = &messagingView_;
        break;
    case ViewId::Social:
        slot = &socialView_;
        break;
    case ViewId::Presence:
        slot = &presenceView_;
        break;
    case ViewId::About:
        slot = &aboutView_;
        break;
    case ViewId::Options:
        slot = &optionsView_;
        break;
    case ViewId::None:
        return nullptr;
    }

    if (*slot == nullptr)
    {
        if (!suppressFocusRememberOnViewCreation_ &&
            currentView_ != nullptr &&
            currentViewId_ != viewId)
        {
            focusTransition_.Remember(currentView_);
        }
        *slot = CreateView(viewId);
    }

    return *slot;
}

void AppNavigator::ResetView(ViewId viewId)
{
    wxWindow** slot = nullptr;
    switch (viewId)
    {
    case ViewId::Home:
        slot = &homeView_;
        break;
    case ViewId::MainMenu:
        slot = &mainMenuView_;
        break;
    case ViewId::Catalog:
        slot = &catalogView_;
        break;
    case ViewId::JoinRooms:
        slot = &joinRoomsView_;
        break;
    case ViewId::Vault:
        slot = &vaultView_;
        break;
    case ViewId::Room:
        slot = &roomView_;
        break;
    case ViewId::StoryBook:
        slot = &storyBookView_;
        break;
    case ViewId::Leaderboard:
        slot = &leaderboardView_;
        break;
    case ViewId::Chat:
        slot = &chatView_;
        break;
    case ViewId::Messaging:
        slot = &messagingView_;
        break;
    case ViewId::Social:
        slot = &socialView_;
        break;
    case ViewId::Presence:
        slot = &presenceView_;
        break;
    case ViewId::About:
        slot = &aboutView_;
        break;
    case ViewId::Options:
        slot = &optionsView_;
        break;
    case ViewId::None:
        return;
    }

    if (slot == nullptr || *slot == nullptr)
    {
        return;
    }

    if (hostFrame_ != nullptr)
    {
        hostFrame_->RemoveContent(*slot);
    }

    if (currentView_ == *slot)
    {
        currentView_ = nullptr;
        currentViewId_ = ViewId::None;
    }

    wxWindow* view = *slot;
    *slot = nullptr;
    focusTransition_.Forget(view);
    view->Destroy();
}

void AppNavigator::ResetSessionViews()
{
    messagingOpenedFromSocial_ = false;
    sessionDataPrewarmed_ = false;
    sessionViewsPrewarmed_ = false;
    if (catalogPrewarmTask_ != nullptr)
    {
        catalogPrewarmTask_->RequestCancel();
        catalogPrewarmTask_.reset();
    }
    catalogService_.ClearCache();
    ResetView(ViewId::MainMenu);
    ResetView(ViewId::Catalog);
    ResetView(ViewId::JoinRooms);
    ResetView(ViewId::Vault);
    ResetView(ViewId::Room);
    ResetView(ViewId::StoryBook);
    ResetView(ViewId::Leaderboard);
    ResetView(ViewId::Chat);
    ResetView(ViewId::Messaging);
    ResetView(ViewId::Social);
    ResetView(ViewId::Presence);
    ResetView(ViewId::About);
    ResetView(ViewId::Options);
    focusTransition_.Clear();
}
}
