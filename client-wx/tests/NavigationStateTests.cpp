#include <cassert>

#include "modules/social/presentation/SocialNavigationState.h"
#include "modules/messaging/presentation/MessagingNavigationState.h"
#include "modules/options/presentation/OptionsEditSession.h"

int main()
{
    using lila::modules::social::presentation::SocialNavigationState;
    using lila::modules::social::presentation::SocialSection;
    SocialNavigationState social(3);
    assert(social.lastMenuIndex == 3);
    social.EnterSection(SocialSection::Blocked, 4);
    assert(social.currentScreen == SocialNavigationState::Screen::Section);
    assert(social.currentSection == SocialSection::Blocked);
    assert(social.lastMenuIndex == 4);
    social.RememberProfileReturnSection();
    social.BeginProfile(42);
    assert(social.returnSectionFromProfile == SocialSection::Blocked);
    assert(social.profileTargetUserId == 42);
    social.ResetProfileNavigation();
    assert(!social.returnSectionFromProfile.has_value());
    assert(!social.profileTargetUserId.has_value());
    assert(social.profileEditorMode == SocialNavigationState::ProfileEditorMode::Menu);
    social.EnterMenu();
    assert(social.currentScreen == SocialNavigationState::Screen::Menu);

    using lila::modules::messaging::presentation::MessagingNavigationState;
    using lila::modules::messaging::domain::MessagingBox;
    MessagingNavigationState messaging;
    messaging.SelectBox(MessagingBox::Deleted);
    messaging.BeginCompose(MessagingNavigationState::Screen::Detail);
    assert(messaging.currentBox == MessagingBox::Deleted);
    assert(messaging.currentScreen == MessagingNavigationState::Screen::Compose);
    assert(messaging.screenBeforeCompose == MessagingNavigationState::Screen::Detail);
    messaging.Enter(messaging.screenBeforeCompose);
    assert(messaging.currentScreen == MessagingNavigationState::Screen::Detail);

    using lila::modules::options::presentation::OptionsEditSession;
    lila::modules::options::domain::OptionsState base;
    OptionsEditSession edit;
    edit.CaptureInitial(base);
    assert(!edit.HasUnsavedChanges(base));
    auto changed = base;
    changed.confirmExit = !changed.confirmExit;
    assert(edit.HasUnsavedChanges(changed));
    edit.EnterSection();
    assert(edit.isInsideSection);
    edit.LeaveSection();
    assert(!edit.isInsideSection);
}
