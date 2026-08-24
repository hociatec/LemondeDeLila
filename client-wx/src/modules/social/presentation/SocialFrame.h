#pragma once

#include "shared/text/presentation/encoding/Encoding.h"

#include <atomic>
#include <functional>
#include <memory>
#include <optional>
#include <string_view>

#include <wx/string.h>

#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/presentation/SocialActionId.h"
#include "modules/social/presentation/SocialDataStore.h"
#include "modules/social/presentation/SocialPresentationModel.h"
#include "modules/social/presentation/SocialSelectionMemory.h"
#include "modules/social/presentation/SocialNavigationState.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/catalog/UiTexts.h"

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
class SocialProfileCoordinator;
class SocialScreenCoordinator;
class SocialSectionCoordinator;
class SocialSectionPresenter;
class SocialView;

class SocialFrame final : public lila::shared::accessibility::NonFocusablePanel, public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;
    using OpenMessagingRequestedHandler = std::function<void(std::size_t selectedMenuIndex)>;
    using OpenStoryBookRequestedHandler = std::function<void(int userId, std::string username)>;

    SocialFrame(
        wxWindow* parent,
        lila::modules::social::application::SocialService& socialService,
        OpenMessagingRequestedHandler onOpenMessagingRequested,
        OpenStoryBookRequestedHandler onOpenStoryBookRequested,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested,
        std::size_t initialSelectedMenuIndex = 0);
    ~SocialFrame() override;
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    using Screen = SocialNavigationState::Screen;
    using ProfileEditorMode = SocialNavigationState::ProfileEditorMode;

    void BindEvents();
    void BindMenuEvents();
    void BindProfileEvents();
    void BindSectionEvents(SocialSection section);
    void HandleSectionAction(SocialSection section, std::string_view actionId);
    void OpenProfile(int userId);
    void RefreshSection(SocialSection section);
    void SyncPanels();
    void ShowActionFeedback(const wxString& message, const wxString& title = lila::shared::text::FromUtf8(lila::shared::text::ui::SocialFrameHeader));
    void RunBackgroundTask(
        const wxString& busyMessage,
        const std::function<void()>& worker,
        const std::function<void()>& onSuccess = {},
        bool announceBusy = true);
    void SetBusyState(bool busy, const wxString& message = wxEmptyString, bool announce = true);
    void ApplyBusyState();
    void RunUiAction(const std::function<void()>& action);
    void UpdateStatus(const wxString& message, bool isError = false, bool announce = true);
    void ScheduleFocusCurrentScreen();
    void RefreshCurrentSection();
    [[nodiscard]] lila::shared::accessibility::NavigationController::Scope BuildFocusScope() const;
    [[nodiscard]] bool IsExplicitTabNavigationContext() const noexcept;
    [[nodiscard]] wxWindow* ResolveMenuFocusTarget();
    [[nodiscard]] wxWindow* ResolveCurrentSectionTarget();
    void ArmInitialListActivationSuppression() noexcept;
    [[nodiscard]] bool ConsumePendingListActivationSuppression() noexcept;

    OpenMessagingRequestedHandler onOpenMessagingRequested_;
    OpenStoryBookRequestedHandler onOpenStoryBookRequested_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    bool isBusy_ = false;
    SocialNavigationState navigationState_;
    std::atomic<bool> isClosing_ = false;
    SocialSelectionMemory selectionMemory_;
    SocialDataStore dataStore_;
    bool suppressNextListActivation_ = false;
    std::unique_ptr<SocialActionController> actionController_;
    std::unique_ptr<SocialLoadController> loadController_;
    std::unique_ptr<SocialProfileCoordinator> profileCoordinator_;
    std::unique_ptr<SocialScreenCoordinator> screenCoordinator_;
    std::unique_ptr<SocialSectionCoordinator> sectionCoordinator_;
    std::unique_ptr<SocialSectionPresenter> sectionPresenter_;

    SocialView* view_ = nullptr;
};
}
