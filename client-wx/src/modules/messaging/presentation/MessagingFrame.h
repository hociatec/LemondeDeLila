#pragma once

#include <functional>
#include <optional>
#include <memory>
#include <vector>

#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"
#include "modules/messaging/presentation/MessagingSelectionMemory.h"
#include "modules/messaging/presentation/MessagingNavigationState.h"

class wxWindow;

namespace lila::modules::messaging::application
{
class MessagingService;
}

namespace lila::shared::ui::controls
{
class VerticalMenu;
}

namespace lila::modules::messaging::presentation
{
class MessagingView;
class MessagingActionController;
class MessagingComposeController;
class MessagingMailboxController;
class MessagingFocusController;
class MessagingScreenCoordinator;

class MessagingFrame final : public lila::shared::accessibility::NonFocusablePanel, public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    MessagingFrame(
        wxWindow* parent,
        lila::modules::messaging::application::MessagingService& messagingService,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~MessagingFrame() override;
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

private:
    using Screen = MessagingNavigationState::Screen;

    void BindEvents();
    void SetScreen(Screen screen, std::optional<Screen> previousScreen = std::nullopt);
    bool NavigateBack(bool preserveCurrentBox = false);
    void UpdateStatus(const wxString& message, bool isError = false);
    void RunBackgroundTask(
        const wxString& busyMessage,
        const std::function<void()>& worker,
        const std::function<void()>& onSuccess = {});
    void SetBusyState(bool busy, const wxString& message = wxEmptyString);
    void SyncBusyState();
    void SyncPanels();
    void SyncSelectionState();
    void ScheduleFocusCurrentScreen();
    void RefreshCurrentBox(bool preserveSelection);
    void OpenSelectedMenu(std::size_t selectedMenuIndex);
    void OpenDetail();
    void OpenCompose(std::optional<domain::MessagingUser> recipient, Screen returnScreen);
    void CloseCompose(bool preserveCurrentBox = false);
    void SaveCurrentBoxSelection();
    void RestoreCurrentBoxSelection();
    void LoadBox(domain::MessagingBox box, bool preserveSelection = false);
    void SendComposedMessage();
    void DeleteSelectedMessage();
    void RestoreSelectedMessage();
    void PurgeSelectedMessage();
    void ReplyToSelectedMessage();
    void MarkSelectedMessageRead();
    [[nodiscard]] std::optional<domain::MessagingMessage> GetSelectedMessage() const;

    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    bool isBusy_ = false;
    MessagingNavigationState navigationState_;
    std::vector<domain::MessagingMessage> boxMessages_;

    MessagingView* view_ = nullptr;

    MessagingSelectionMemory selectionMemory_;
    std::unique_ptr<MessagingActionController> actionController_;
    std::unique_ptr<MessagingComposeController> composeController_;
    std::unique_ptr<MessagingMailboxController> mailboxController_;
    std::unique_ptr<MessagingFocusController> focusController_;
    std::unique_ptr<MessagingScreenCoordinator> screenCoordinator_;
};
}
