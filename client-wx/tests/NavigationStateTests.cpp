#include <cassert>
#include <set>

#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/messaging/presentation/MessagingNavigationState.h"
#include "modules/options/presentation/OptionsEditSession.h"
#include "modules/catalog/application/CatalogVisibilityPolicy.h"
#include "modules/admin/domain/AdminCommand.h"
#include "modules/admin/domain/AdminArea.h"
#include "modules/main_menu/presentation/MainMenuContent.h"
#include "modules/session/domain/Session.h"

int main()
{
    using lila::modules::session::domain::Session;
    Session regularSession;
    regularSession.roles = {"ROLE_USER"};
    assert(!regularSession.IsAdmin());
    Session adminSession;
    adminSession.roles = {"ROLE_USER", "ROLE_ADMIN"};
    assert(adminSession.IsAdmin());

    const auto regularMenu =
        lila::modules::main_menu::presentation::GetMainMenuEntries(false);
    const auto adminMenu =
        lila::modules::main_menu::presentation::GetMainMenuEntries(true);
    assert(adminMenu.size() == regularMenu.size() + 1);
    assert(adminMenu[3].action ==
        lila::modules::main_menu::presentation::MainMenuAction::OpenAdmin);

    const auto& adminCommands = lila::modules::admin::domain::GetAdminCommands();
    assert(adminCommands.size() >= 60);
    std::set<std::string> commandIds;
    bool hasHttp = false;
    bool hasApiWs = false;
    bool hasNotifyWs = false;
    bool hasMaintenanceProtection = false;
    for (const auto& command : adminCommands)
    {
        assert(!command.id.empty());
        assert(!command.operation.empty());
        assert(commandIds.insert(command.id).second);
        hasHttp = hasHttp || command.transport ==
            lila::modules::admin::domain::AdminTransport::HttpJson;
        hasApiWs = hasApiWs || command.transport ==
            lila::modules::admin::domain::AdminTransport::ApiWebSocket;
        hasNotifyWs = hasNotifyWs || command.transport ==
            lila::modules::admin::domain::AdminTransport::NotificationWebSocket;
        hasMaintenanceProtection = hasMaintenanceProtection || command.maintenanceToken;
    }
    assert(hasHttp && hasApiWs && hasNotifyWs && hasMaintenanceProtection);
    for (const auto& section : lila::modules::admin::domain::GetAdminSections())
        assert(!lila::modules::admin::domain::CommandsForSection(section.id).empty());
    const auto& adminAreas = lila::modules::admin::domain::GetAdminAreas();
    assert(adminAreas.size() == 16);
    assert(adminAreas.front().group == L"JEUX");
    assert(adminAreas[4].group == L"UTILISATEURS");
    assert(adminAreas[7].group == L"COMMUNICATION");
    assert(adminAreas[10].group == L"OUTILS");

    using lila::modules::social::presentation::SocialNavigationState;
    using lila::modules::social::presentation::SocialSection;
    SocialNavigationState social(3);
    assert(social.lastMenuIndex == 3);
    assert(!social.CanGoBack());
    social.PushCurrent();
    social.EnterSection(SocialSection::Blocked, 4);
    assert(social.currentScreen == SocialNavigationState::Screen::Section);
    assert(social.currentSection == SocialSection::Blocked);
    assert(social.lastMenuIndex == 4);
    social.PushCurrent();
    social.BeginProfile(42);
    assert(social.profileTargetUserId == 42);
    social.profileEditorMode = SocialNavigationState::ProfileEditorMode::Bio;
    assert(social.GoBack());
    assert(social.currentScreen == SocialNavigationState::Screen::Section);
    assert(social.currentSection == SocialSection::Blocked);
    assert(!social.profileTargetUserId.has_value());
    assert(social.profileEditorMode == SocialNavigationState::ProfileEditorMode::Menu);
    assert(social.GoBack());
    assert(social.currentScreen == SocialNavigationState::Screen::Menu);
    assert(social.lastMenuIndex == 3);
    assert(!social.GoBack());

    using lila::modules::messaging::presentation::MessagingNavigationState;
    using lila::modules::messaging::domain::MessagingBox;
    MessagingNavigationState messaging;
    messaging.SelectBox(MessagingBox::Deleted);
    messaging.Enter(MessagingNavigationState::Screen::Detail);
    messaging.PushCurrent();
    messaging.Enter(MessagingNavigationState::Screen::Compose);
    assert(messaging.currentBox == MessagingBox::Deleted);
    assert(messaging.currentScreen == MessagingNavigationState::Screen::Compose);
    assert(messaging.CanGoBack());
    assert(messaging.GoBack());
    assert(messaging.currentScreen == MessagingNavigationState::Screen::Detail);
    assert(messaging.currentBox == MessagingBox::Deleted);
    assert(!messaging.GoBack());

    using lila::modules::options::presentation::OptionsEditSession;
    lila::modules::options::domain::OptionsState base;
    OptionsEditSession edit;
    edit.CaptureInitial(base);
    assert(!edit.HasUnsavedChanges(base));
    auto changed = base;
    changed.general.confirmExit = !changed.general.confirmExit;
    assert(edit.HasUnsavedChanges(changed));
    edit.CaptureInitial(changed);
    assert(!edit.HasUnsavedChanges(changed));

    using lila::modules::catalog::application::CatalogVisibilityPolicy;
    lila::modules::catalog::domain::CatalogGame betaGame;
    betaGame.name = "Jeu test";
    betaGame.status = "beta";
    assert(!CatalogVisibilityPolicy::IsVisible(betaGame, false, false));
    assert(CatalogVisibilityPolicy::IsVisible(betaGame, true, false));
    assert(CatalogVisibilityPolicy::IsVisible(betaGame, false, true));
    assert(CatalogVisibilityPolicy::DisplayName(betaGame, false) == "Jeu test");
    assert(CatalogVisibilityPolicy::DisplayName(betaGame, true) ==
        "Jeu test (bêta)");

    auto constructionGame = betaGame;
    constructionGame.status = "construction";
    assert(!CatalogVisibilityPolicy::IsVisible(constructionGame, true, false));
    assert(CatalogVisibilityPolicy::IsVisible(constructionGame, false, true));
}
