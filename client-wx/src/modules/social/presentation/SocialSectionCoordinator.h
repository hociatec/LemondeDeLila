#pragma once

#include <functional>
#include <memory>
#include <optional>

#include <wx/string.h>

#include "modules/social/presentation/SocialSection.h"

namespace lila::modules::social::presentation
{
class SocialDataStore;
class SocialLoadController;
class SocialNavigationState;
class SocialSectionPresenter;
class SocialView;

class SocialSectionCoordinator final
{
public:
    struct Callbacks final
    {
        std::function<void(const wxString&, const std::function<void()>&, const std::function<void()>&, bool)> runBackgroundTask;
        std::function<void(const wxString&, bool, bool)> updateStatus;
        std::function<void()> focusCurrentScreen;
    };

    SocialSectionCoordinator(
        SocialLoadController& loadController,
        SocialDataStore& dataStore,
        SocialNavigationState& navigationState,
        SocialSectionPresenter& sectionPresenter,
        SocialView& view,
        Callbacks callbacks) noexcept;

    void ActivateSection(SocialSection section);
    void RefreshSection(SocialSection section);
    void RefreshCurrentSection();
    void OpenProfile(int userId);
    void OpenOwnProfile();

private:
    void LoadFriends();
    void LoadIncomingRequests();
    void LoadOutgoingRequests();
    void LoadBlockedUsers();
    void LoadProfile(std::optional<int> userId);
    void FocusSectionIfVisible(SocialSection section) const;
    void ApplyProfileTitle() const;

    SocialLoadController& loadController_;
    SocialDataStore& dataStore_;
    SocialNavigationState& navigationState_;
    SocialSectionPresenter& sectionPresenter_;
    SocialView& view_;
    Callbacks callbacks_;
};
}
