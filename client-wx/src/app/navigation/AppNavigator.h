#pragma once

#include <memory>
#include <string>

#include "modules/user/domain/AuthenticationResult.h"
#include "shared/accessibility/FocusTransition.h"
#include "shared/audio/AudioService.h"

class wxFrame;
class wxWindow;

namespace lila::shared::concurrency
{
class BackgroundTaskHandle;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::chat::application
{
class ChatService;
}

namespace lila::modules::catalog::application
{
class CatalogService;
}
namespace lila::modules::catalog::domain
{
struct CatalogGame;
}

namespace lila::modules::storybook::application
{
class StoryBookService;
}

namespace lila::modules::leaderboard::application
{
class LeaderboardService;
}

namespace lila::modules::rooms::application
{
class RoomLobbyService;
class RoomSessionService;
}

namespace lila::modules::vault::application
{
class VaultService;
}

namespace lila::modules::social::application
{
class SocialService;
}

namespace lila::modules::presence::application
{
class PresenceMonitor;
}

namespace lila::modules::messaging::application
{
class MessagingService;
}

namespace lila::modules::user::application
{
class LoginUseCase;
class RegisterUseCase;
}

namespace lila::app::navigation
{
class HostFrame;

namespace detail
{
enum class ViewId
{
    None,
    Home,
    MainMenu,
    Catalog,
    JoinRooms,
    Vault,
    Room,
    StoryBook,
    Leaderboard,
    Chat,
    Messaging,
    Social,
    Presence,
    About,
    Options
};
}

struct AuthNavigationDependencies final
{
    lila::modules::user::application::LoginUseCase& loginUseCase;
    lila::modules::user::application::RegisterUseCase& registerUseCase;
    lila::modules::session::application::SessionStore& sessionStore;
    lila::modules::options::application::OptionsStore& optionsStore;
};

struct GameNavigationDependencies final
{
    lila::modules::catalog::application::CatalogService& catalogService;
    lila::modules::rooms::application::RoomLobbyService& roomLobbyService;
    lila::modules::rooms::application::RoomSessionService& roomSessionService;
    lila::modules::vault::application::VaultService& vaultService;
    lila::modules::storybook::application::StoryBookService& storyBookService;
    lila::modules::leaderboard::application::LeaderboardService& leaderboardService;
};

struct SocialNavigationDependencies final
{
    lila::modules::chat::application::ChatService& chatService;
    lila::modules::messaging::application::MessagingService& messagingService;
    lila::modules::social::application::SocialService& socialService;
    lila::modules::presence::application::PresenceMonitor& presenceMonitor;
};

class AppNavigator final
{
public:
    AppNavigator(
        AuthNavigationDependencies auth,
        GameNavigationDependencies game,
        SocialNavigationDependencies social);

    bool Start();

private:
    void ShowHome();
    void ShowSession(std::size_t selectedIndex = 0, bool resetInitialFocus = false);
    void ShowCatalog(std::size_t selectedIndex);
    void ShowJoinRooms();
    void ShowVault();
    void CreateRoom(const lila::modules::catalog::domain::CatalogGame& game);
    void JoinRoom(int roomId, bool spectator);
    void RestoreRoom(int roomId);
    void ShowOwnStoryBook();
    void ShowUserStoryBook(int userId, std::string username, detail::ViewId returnView);
    void ShowLeaderboard();
    void ShowChat(std::size_t selectedIndex);
    void ShowMessaging(std::size_t selectedIndex);
    void ShowMessagingFromSocial(std::size_t socialMenuIndex);
    void ShowSocial(std::size_t selectedIndex, std::size_t socialMenuIndex = 0);
    void ShowPresence();
    void ShowAbout(std::size_t selectedIndex);
    void ShowOptions(std::size_t selectedIndex);
    void CloseApplication();
    void PrewarmSessionData();
    void ReplaceView(detail::ViewId nextViewId, wxWindow* nextView);
    void ShowLegacyWindow(wxFrame* nextWindow);
    void OnLoginSucceeded(const lila::modules::user::domain::AuthenticationResult& result);
    void OnLogoutRequested(std::size_t selectedIndex);
    void ResetView(detail::ViewId viewId);
    void ResetSessionViews();
    void ApplyViewFocus(wxWindow* view);
    void ReturnToCatalogAfterRoomClose(bool resetVaultFocus, bool resetCatalogFocus);
    [[nodiscard]] wxWindow* CreateView(detail::ViewId viewId);
    [[nodiscard]] wxWindow* GetOrCreateView(detail::ViewId viewId);

    lila::modules::user::application::LoginUseCase& loginUseCase_;
    lila::modules::user::application::RegisterUseCase& registerUseCase_;
    lila::modules::session::application::SessionStore& sessionStore_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    lila::modules::catalog::application::CatalogService& catalogService_;
    lila::modules::rooms::application::RoomLobbyService& roomLobbyService_;
    lila::modules::rooms::application::RoomSessionService& roomSessionService_;
    lila::modules::vault::application::VaultService& vaultService_;
    lila::modules::storybook::application::StoryBookService& storyBookService_;
    lila::modules::leaderboard::application::LeaderboardService& leaderboardService_;
    lila::modules::chat::application::ChatService& chatService_;
    lila::modules::messaging::application::MessagingService& messagingService_;
    lila::modules::social::application::SocialService& socialService_;
    lila::modules::presence::application::PresenceMonitor& presenceMonitor_;
    std::unique_ptr<lila::shared::audio::AudioService> audioService_;
    HostFrame* hostFrame_ = nullptr;
    detail::ViewId currentViewId_ = detail::ViewId::None;
    wxWindow* currentView_ = nullptr;
    wxFrame* currentLegacyWindow_ = nullptr;
    wxWindow* homeView_ = nullptr;
    wxWindow* mainMenuView_ = nullptr;
    wxWindow* catalogView_ = nullptr;
    wxWindow* joinRoomsView_ = nullptr;
    wxWindow* vaultView_ = nullptr;
    wxWindow* roomView_ = nullptr;
    wxWindow* storyBookView_ = nullptr;
    wxWindow* leaderboardView_ = nullptr;
    wxWindow* chatView_ = nullptr;
    wxWindow* messagingView_ = nullptr;
    wxWindow* socialView_ = nullptr;
    wxWindow* presenceView_ = nullptr;
    wxWindow* aboutView_ = nullptr;
    wxWindow* optionsView_ = nullptr;
    std::size_t lastMainMenuSelection_ = 0;
    std::size_t lastSocialMenuSelection_ = 0;
    bool messagingOpenedFromSocial_ = false;
    bool resetVaultFocusOnNextOpen_ = false;
    bool sessionDataPrewarmed_ = false;
    detail::ViewId previousViewBeforePresence_ = detail::ViewId::MainMenu;
    detail::ViewId storyBookReturnView_ = detail::ViewId::Catalog;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> catalogPrewarmTask_;
    lila::shared::accessibility::FocusTransition focusTransition_;
};
}
