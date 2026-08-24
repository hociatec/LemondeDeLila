#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "shared/accessibility/FocusPlanView.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "modules/chat/application/ChatService.h"
#include "modules/chat/domain/ChatMessage.h"
#include "shared/ui/navigation/NavigationStack.h"

class wxButton;
class wxTextCtrl;


namespace lila::shared::concurrency
{
class BackgroundTaskHandle;
}

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::modules::chat::presentation
{
class ChatFocusController;

class ChatFrame final : public lila::shared::accessibility::NonFocusablePanel, public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    ChatFrame(
        wxWindow* parent,
        lila::modules::chat::application::ChatService& chatService,
        lila::modules::options::application::OptionsStore& optionsStore,
        lila::modules::session::application::SessionStore& sessionStore,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~ChatFrame() override;
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;
    void ResetFocusToComposer();

private:
    struct NavigationSnapshot final
    {
        bool isHistoryActionMode;
        std::optional<std::string> selectedActionMessageId;
        std::optional<std::string> pendingEditMessageId;
    };

    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void RunChatAction(
        const wxString& busyMessage,
        const std::function<void()>& action,
        const std::function<void()>& onSuccess = {});
    void OpenChat();
    void PresentConnectionError(const std::string& message);
    void RefreshHistory();
    void UpdateStatus(const wxString& message, bool isError = false);
    void ShowAccessibleErrorDialog(const wxString& message, const wxString& title);
    void SetBusyState(bool isBusy, const wxString& statusMessage = wxEmptyString);
    void SyncActionState();
    void SendInput();
    void CancelEdit();
    void ClearNavigationHistory();
    void HandleEscape();
    void HandleHistoryActivation();
    void HandleHistoryClick();
    void HandleEditSelected();
    void HandleDeleteSelected();
    bool ConfirmClose();
    void InvalidateOpenChatRequest();
    void RequestCloseToSession();
    [[nodiscard]] std::optional<domain::ChatMessage> GetSelectedMessage() const;
    [[nodiscard]] bool CanActOnMessage(const domain::ChatMessage& message) const;
    [[nodiscard]] wxString BuildMessageLabel(const domain::ChatMessage& message) const;
    void PushNavigationSnapshot();
    [[nodiscard]] bool NavigateBack();
    void ApplyNavigationSnapshot(const NavigationSnapshot& snapshot);
    void BeginEdit(const domain::ChatMessage& message);

    lila::modules::chat::application::ChatService& chatService_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    lila::modules::session::application::SessionStore& sessionStore_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    wxTextCtrl* statusLabel_ = nullptr;
    wxTextCtrl* historyCtrl_ = nullptr;
    wxTextCtrl* inputCtrl_ = nullptr;
    wxButton* editMessageButton_ = nullptr;
    wxButton* deleteMessageButton_ = nullptr;
    bool isBusy_ = false;
    bool isHistoryActionMode_ = false;
    bool isReturningToSession_ = false;
    std::size_t activeOpenChatRequestId_ = 0;
    std::optional<std::string> selectedActionMessageId_;
    std::vector<domain::ChatMessage> visibleMessages_;
    std::vector<long> messageStartPositions_;
    std::optional<std::string> pendingEditMessageId_;
    lila::shared::ui::navigation::NavigationStack<NavigationSnapshot> navigationHistory_;
    std::shared_ptr<lila::modules::chat::application::ChatService::EventHandlers> eventHandlers_;
    std::unique_ptr<ChatFocusController> focusController_;
    std::shared_ptr<lila::shared::concurrency::BackgroundTaskHandle> openChatTask_;
};
}
