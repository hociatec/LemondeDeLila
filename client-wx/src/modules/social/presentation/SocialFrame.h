#pragma once

#include "shared/text/Encoding.h"

#include <atomic>
#include <functional>
#include <optional>
#include <memory>

#include <wx/frame.h>
#include <wx/string.h>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialSelectionMemory.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"

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
class SocialActionController;
class SocialLoadController;
class SocialFocusController;
class SocialSectionPresenter;
class SocialView;

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
    ~SocialFrame() override;

private:
    using Screen = SocialNavigationState::Screen;
    using ProfileEditorMode = SocialNavigationState::ProfileEditorMode;

    void BindEvents();
    void BindMenuEvents();
    void BindFriendsEvents();
    void BindIncomingRequestsEvents();
    void BindOutgoingRequestsEvents();
    void BindBlockedUsersEvents();
    void BindProfileEvents();
    void BindSectionSelectionRefresh(lila::shared::ui::controls::VerticalMenu& list);
    void OpenProfile(int userId);
    void RefreshSection(SocialSection section);
    void SetScreen(Screen screen);
    void ShowActionFeedback(const wxString& message, const wxString& title = lila::shared::text::FromUtf8(lila::shared::text::ui::SocialFrameHeader));
    void RunBackgroundTask(
        const wxString& busyMessage,
        const std::function<void()>& worker,
        const std::function<void()>& onSuccess = {});
    void SetBusyState(bool busy, const wxString& message = wxEmptyString);
    void ApplyBusyState();
    void SetSection(SocialSection section);
    void ActivateSelectedMenu();
    void ActivateMenuIndex(std::size_t index);
    void ActivateProfileEditorSelection();
    void HandleEscape();
    void RunUiAction(const std::function<void()>& action);
    void UpdateStatus(const wxString& message, bool isError = false);
    void RefreshCurrentSection();
    void LoadFriends();
    void LoadIncomingRequests();
    void LoadOutgoingRequests();
    void LoadBlockedUsers();
    void LoadProfile(std::optional<int> userId = std::nullopt);
    void SaveProfile();
    void StartProfileEdit(ProfileEditorMode mode);
    void ExitProfileEditMode();
    bool TryExitProfile();

    OpenMessagingRequestedHandler onOpenMessagingRequested_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    bool isBusy_ = false;
    SocialNavigationState navigationState_;
    std::atomic<bool> isClosing_ = false;
    SocialSelectionMemory selectionMemory_;
    SocialDataStore dataStore_;
    std::unique_ptr<SocialActionController> actionController_;
    std::unique_ptr<SocialLoadController> loadController_;
    std::unique_ptr<SocialFocusController> focusController_;
    std::unique_ptr<SocialSectionPresenter> sectionPresenter_;

    SocialView* view_ = nullptr;
};
}
