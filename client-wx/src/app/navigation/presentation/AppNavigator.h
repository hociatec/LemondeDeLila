#pragma once

#include <memory>
#include <string>

#include <wx/timer.h>

#include "app/navigation/domain/ViewId.h"
#include "app/navigation/presentation/NavigationDependencies.h"
#include "app/navigation/presentation/ViewRegistry.h"
#include "shared/accessibility/application/FocusTransition.h"

class wxWindow;

namespace lila::shared::concurrency
{
class BackgroundTaskHandle;
}

namespace lila::modules::catalog::domain
{
struct CatalogGame;
}

namespace lila::modules::user::domain
{
struct AuthenticationResult;
}

namespace lila::app::navigation
{
class HostFrame;

class AppNavigator final
{
public:
    AppNavigator(
        AuthNavigationDependencies auth,
        GameNavigationDependencies game,
        SocialNavigationDependencies social,
        AudioNavigationDependencies audio);

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
    void ShowUserStoryBook(int userId, std::string username, domain::ViewId returnView);
    void ShowLeaderboard();
    void ShowChat(std::size_t selectedIndex);
    void ShowMessaging(std::size_t selectedIndex);
    void ShowMessagingFromSocial(std::size_t socialMenuIndex);
    void ShowSocial(std::size_t selectedIndex, std::size_t socialMenuIndex = 0);
    void ShowPresence();
    void ShowAbout(std::size_t selectedIndex);
    void ShowOptions(std::size_t selectedIndex);
    void CloseApplication();
    void FinishCloseApplication();
    void OnSessionRevocationFinished();
    void ArmCloseRevocationTimeout();
    void PrewarmSessionData();
    void ReplaceView(domain::ViewId nextViewId, wxWindow* nextView);
    void OnLoginSucceeded(const lila::modules::user::domain::AuthenticationResult& result);
    void OnLogoutRequested(std::size_t selectedIndex);
    void ResetView(domain::ViewId viewId);
    void ResetSessionViews();
    void ApplyViewFocus(wxWindow* view);
    void ReturnToCatalogAfterRoomClose(bool resetVaultFocus, bool resetCatalogFocus);
    [[nodiscard]] wxWindow* CreateView(domain::ViewId viewId);
    [[nodiscard]] wxWindow* CreateCoreView(domain::ViewId viewId);
    [[nodiscard]] wxWindow* CreateGameView(domain::ViewId viewId);
    [[nodiscard]] wxWindow* CreateSocialView(domain::ViewId viewId);
    [[nodiscard]] wxWindow* GetOrCreateView(domain::ViewId viewId);

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
    lila::modules::audio::application::IAudioService& audioService_;
    HostFrame* hostFrame_ = nullptr;
    domain::ViewId currentViewId_ = domain::ViewId::None;
    wxWindow* currentView_ = nullptr;
    ViewRegistry views_;
    std::size_t lastMainMenuSelection_ = 0;
    std::size_t lastSocialMenuSelection_ = 0;
    bool messagingOpenedFromSocial_ = false;
    bool resetVaultFocusOnNextOpen_ = false;
    bool sessionDataPrewarmed_ = false;
    domain::ViewId previousViewBeforePresence_ = domain::ViewId::MainMenu;
    domain::ViewId storyBookReturnView_ = domain::ViewId::Catalog;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> catalogPrewarmTask_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> sessionRevocationTask_;
    std::unique_ptr<wxTimer> closeRevocationTimeout_;
    bool closing_ = false;
    bool closeFinalized_ = false;
    lila::shared::accessibility::FocusTransition focusTransition_;
};
}
