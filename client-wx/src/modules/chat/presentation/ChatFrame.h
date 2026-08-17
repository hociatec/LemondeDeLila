#pragma once

#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <wx/frame.h>

#include "modules/chat/domain/ChatMessage.h"

class wxButton;
class wxListBox;
class wxTextCtrl;

namespace lila::modules::chat::application
{
class ChatService;
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
class ChatFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    ChatFrame(
        lila::modules::chat::application::ChatService& chatService,
        lila::modules::options::application::OptionsStore& optionsStore,
        lila::modules::session::application::SessionStore& sessionStore,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~ChatFrame() override;

private:
    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void RunChatAction(
        const wxString& busyMessage,
        const std::function<void()>& action,
        const std::function<void()>& onSuccess = {});
    void OpenChat();
    void RefreshHistory();
    void UpdateStatus(const wxString& message, bool isError = false);
    void ShowAccessibleErrorDialog(const wxString& message, const wxString& title);
    void SetBusyState(bool isBusy, const wxString& statusMessage = wxEmptyString);
    void SyncActionState();
    void SendInput();
    void CancelEdit();
    void HandleEscape();
    void HandleHistoryActivation();
    void FocusHistoryAction(bool isReverse);
    bool ConfirmClose();
    void InvalidateOpenChatRequest();
    void RequestCloseToSession();
    [[nodiscard]] std::optional<domain::ChatMessage> GetSelectedMessage() const;
    [[nodiscard]] bool CanActOnMessage(const domain::ChatMessage& message) const;
    [[nodiscard]] wxString BuildMessageLabel(const domain::ChatMessage& message) const;
    void BeginEdit(const domain::ChatMessage& message);

    lila::modules::chat::application::ChatService& chatService_;
    lila::modules::options::application::OptionsStore& optionsStore_;
    lila::modules::session::application::SessionStore& sessionStore_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    wxTextCtrl* statusLabel_ = nullptr;
    wxListBox* historyList_ = nullptr;
    wxTextCtrl* emptyHistoryCtrl_ = nullptr;
    wxTextCtrl* inputCtrl_ = nullptr;
    wxButton* editMessageButton_ = nullptr;
    wxButton* deleteMessageButton_ = nullptr;
    bool isBusy_ = false;
    bool isHistoryActionMode_ = false;
    bool isReturningToSession_ = false;
    std::size_t activeOpenChatRequestId_ = 0;
    std::optional<std::string> selectedActionMessageId_;
    std::vector<domain::ChatMessage> visibleMessages_;
    std::optional<std::string> pendingEditMessageId_;
};
}
