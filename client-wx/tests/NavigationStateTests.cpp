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
}
