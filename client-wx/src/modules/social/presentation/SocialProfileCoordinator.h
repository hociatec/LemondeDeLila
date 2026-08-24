#pragma once

#include <functional>
#include <string>

#include "modules/social/presentation/SocialActionId.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include <wx/string.h>

namespace lila::modules::social::presentation
{
class SocialActionController;
class SocialDataStore;
class SocialSectionPresenter;
class SocialView;

class SocialProfileCoordinator final
{
public:
    using ProfileEditorMode = SocialNavigationState::ProfileEditorMode;

    struct Callbacks final
    {
        std::function<void(const wxString&, bool)> updateStatus;
        std::function<void(const wxString&)> showFeedback;
        std::function<void()> scheduleFocusCurrentScreen;
        std::function<void(int, std::string)> openStoryBook;
    };

    SocialProfileCoordinator(
        SocialNavigationState& navigationState,
        SocialDataStore& dataStore,
        SocialSectionPresenter& sectionPresenter,
        SocialView& view,
        SocialActionController& actionController,
        Callbacks callbacks) noexcept;

    void ActivateSelectedAction();
    void StartEdit(ProfileEditorMode mode);
    void SaveProfile();

private:
    SocialNavigationState& navigationState_;
    SocialDataStore& dataStore_;
    SocialSectionPresenter& sectionPresenter_;
    SocialView& view_;
    SocialActionController& actionController_;
    Callbacks callbacks_;
};
}
