#pragma once

#include <atomic>
#include <functional>
#include <optional>
#include <array>
#include <vector>

#include <wx/frame.h>
#include <wx/string.h>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "shared/errors/ErrorMessages.h"

class wxButton;
class wxChoice;
class wxPanel;
class wxSimplebook;
class wxStaticText;
class wxTextCtrl;
class wxWindow;

namespace lila::modules::social::application
{
class SocialService;
}

namespace lila::shared::ui::controls
{
class VerticalMenu;
}

namespace lila::modules::social::presentation
{
class SocialFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;
    using OpenMessagingRequestedHandler = std::function<void(std::size_t selectedMenuIndex)>;

    SocialFrame(
        lila::modules::social::application::SocialService& socialService,
        OpenMessagingRequestedHandler onOpenMessagingRequested,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested,
        std::size_t initialSelectedMenuIndex = 0);

private:
    enum class Screen
    {
        Menu,
        Section,
    };

    enum class Section
    {
        Friends,
        IncomingRequests,
        OutgoingRequests,
        Blocked,
        Profile,
    };

    enum class ProfileEditorMode
    {
        Menu,
        Bio,
        VictoryMessage,
        DefeatMessage,
        Visibility,
    };

    void BuildLayout();
    void BuildFriendsSection(wxWindow* parent);
    void BuildIncomingRequestsSection(wxWindow* parent);
    void BuildOutgoingRequestsSection(wxWindow* parent);
    void BuildBlockedSection(wxWindow* parent);
    void BuildProfileSection(wxWindow* parent);
    void ApplyTheme();
    void BindEvents();
    void BindMenuEvents();
    void BindFriendsEvents();
    void BindIncomingRequestsEvents();
    void BindOutgoingRequestsEvents();
    void BindBlockedUsersEvents();
    void BindProfileEvents();
    void BindProfileEditorTabNavigation(wxWindow& window);
    void BindSectionSelectionRefresh(lila::shared::ui::controls::VerticalMenu& list);
    void StoreSectionSelection(Section section);
    void RestoreSectionSelection(lila::shared::ui::controls::VerticalMenu& list, Section section);
    [[nodiscard]] std::optional<int> GetStoredSectionSelection(Section section) const;
    void FocusCurrentScreen();
    void FocusCurrentSectionActionMenu();
    void OpenSelectedProfile();
    void ActivateFriendAction(std::size_t actionIndex);
    void ActivateIncomingAction(std::size_t actionIndex);
    void ActivateOutgoingAction(std::size_t actionIndex);
    void ActivateBlockedAction(std::size_t actionIndex);
    void FocusProfileEditorControl(bool reverse);
    void SetScreen(Screen screen);
    void ShowActionFeedback(const wxString& message, const wxString& title = wxString::FromUTF8(lila::shared::errors::SocialFrameHeader));
    void RunBackgroundTask(
        const wxString& busyMessage,
        const std::function<void()>& worker,
        const std::function<void()>& onSuccess = {});
    void SetBusyState(bool busy, const wxString& message = wxEmptyString);
    void ApplyBusyState();
    void SetSection(Section section, bool restoreFocus);
    void ActivateSelectedMenu();
    void ActivateMenuIndex(std::size_t index);
    void ActivateProfileEditorSelection();
    void HandleEscape();
    void HandleTabNavigation(bool reverse);
    void RunUiAction(const std::function<void()>& action);
    void UpdateStatus(const wxString& message, bool isError = false);
    void RefreshCurrentSection();
    void RefreshAllCaches();
    void LoadFriends();
    void LoadIncomingRequests();
    void LoadOutgoingRequests();
    void LoadBlockedUsers();
    void LoadProfile(std::optional<int> userId = std::nullopt);
    void SaveProfile();
    void StartProfileEdit(ProfileEditorMode mode);
    void ExitProfileEditMode();
    bool TryExitProfile();
    void ShowOnlySectionPanel(wxWindow* targetPanel);
    void SyncSectionVisibility();
    void SyncProfileEditorVisibility();
    void SyncProfileControls();
    void SyncSelectionState();
    [[nodiscard]] bool IsBlockedUser(int userId) const;
    [[nodiscard]] wxWindow* GetFirstFocusableInCurrentScreen() const;
    [[nodiscard]] wxWindow* GetLastFocusableInCurrentScreen() const;
    [[nodiscard]] wxWindow* GetCurrentSectionActionControl() const;
    [[nodiscard]] wxWindow* GetCurrentSectionList() const;
    [[nodiscard]] std::optional<int> GetSelectedUserId() const;
    [[nodiscard]] wxString BuildUserLabel(const domain::SocialUser& user) const;
    [[nodiscard]] wxString BuildRequestLabel(const domain::SocialFriendRequest& request, bool incoming) const;
    [[nodiscard]] wxString BuildProfileInfoText(const domain::SocialProfile& profile) const;
    [[nodiscard]] static std::string VisibilityToFrench(const std::string& value);
    [[nodiscard]] static std::optional<Section> MenuIndexToSection(std::size_t index);
    [[nodiscard]] static std::size_t SectionToMenuIndex(Section section);
    [[nodiscard]] static std::size_t SectionIndex(Section section);
    [[nodiscard]] static wxString BuildSectionStatus(Section section, std::size_t count);

    lila::modules::social::application::SocialService& socialService_;
    OpenMessagingRequestedHandler onOpenMessagingRequested_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    Screen currentScreen_ = Screen::Menu;
    Section currentSection_ = Section::Friends;
    ProfileEditorMode profileEditorMode_ = ProfileEditorMode::Menu;
    std::optional<Section> returnSectionFromProfile_;
    std::optional<int> profileTargetUserId_;
    std::size_t lastMenuIndex_ = 0;
    bool isBusy_ = false;
    std::atomic<bool> isClosing_ = false;
    std::array<std::optional<int>, 5> lastSectionSelection_ = {std::nullopt, std::nullopt, std::nullopt, std::nullopt, std::nullopt};

    std::vector<domain::SocialUser> friends_;
    std::vector<domain::SocialFriendRequest> incomingRequests_;
    std::vector<domain::SocialFriendRequest> outgoingRequests_;
    std::vector<domain::SocialUser> blockedUsers_;
    std::optional<domain::SocialProfile> currentProfile_;

    wxStaticText* titleLabel_ = nullptr;
    wxStaticText* subtitleLabel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxSimplebook* sectionBook_ = nullptr;
    wxPanel* friendsPanel_ = nullptr;
    wxPanel* incomingRequestsPanel_ = nullptr;
    wxPanel* outgoingRequestsPanel_ = nullptr;
    wxPanel* blockedPanel_ = nullptr;
    wxPanel* profilePanel_ = nullptr;

    lila::shared::ui::controls::VerticalMenu* friendsList_ = nullptr;
    wxTextCtrl* emptyFriendsCtrl_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* friendsActionsMenu_ = nullptr;

    lila::shared::ui::controls::VerticalMenu* incomingRequestsList_ = nullptr;
    wxTextCtrl* emptyIncomingRequestsCtrl_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* incomingActionsMenu_ = nullptr;

    lila::shared::ui::controls::VerticalMenu* outgoingRequestsList_ = nullptr;
    wxTextCtrl* emptyOutgoingRequestsCtrl_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* outgoingActionsMenu_ = nullptr;

    lila::shared::ui::controls::VerticalMenu* blockedUsersList_ = nullptr;
    wxTextCtrl* emptyBlockedUsersCtrl_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* blockedActionsMenu_ = nullptr;

    wxStaticText* profileTitleLabel_ = nullptr;
    wxTextCtrl* profileInfoCtrl_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* profileMenu_ = nullptr;
    wxPanel* profileEditorMenuPanel_ = nullptr;
    wxPanel* profileBioEditorPanel_ = nullptr;
    wxPanel* profileVictoryEditorPanel_ = nullptr;
    wxPanel* profileDefeatEditorPanel_ = nullptr;
    wxPanel* profileVisibilityEditorPanel_ = nullptr;
    wxTextCtrl* profileBioCtrl_ = nullptr;
    wxTextCtrl* profileVictoryCtrl_ = nullptr;
    wxTextCtrl* profileDefeatCtrl_ = nullptr;
    wxChoice* profileVisibilityChoice_ = nullptr;
    wxButton* profileSaveButton_ = nullptr;
    wxButton* profileCancelButton_ = nullptr;
};
}
