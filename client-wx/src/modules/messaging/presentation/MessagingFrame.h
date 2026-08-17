#pragma once

#include <functional>
#include <array>
#include <optional>
#include <vector>

#include <wx/frame.h>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"
#include "modules/messaging/domain/MessagingUser.h"

class wxButton;
class wxListBox;
class wxPanel;
class wxSimplebook;
class wxStaticText;
class wxTextCtrl;
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
class MessagingFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    MessagingFrame(
        lila::modules::messaging::application::MessagingService& messagingService,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~MessagingFrame() override = default;

private:
    enum class Screen
    {
        Menu,
        List,
        Detail,
        Compose,
    };

    void BuildLayout();
    void ApplyTheme();
    void BindEvents();
    void SetScreen(Screen screen);
    void FocusCurrentScreen();
    void UpdateStatus(const wxString& message, bool isError = false);
    void RunBackgroundTask(
        const wxString& busyMessage,
        const std::function<void()>& worker,
        const std::function<void()>& onSuccess = {});
    void SetBusyState(bool busy, const wxString& message = wxEmptyString);
    void SyncBusyState();
    void SyncPanels();
    void SyncSelectionState();
    void RefreshCurrentBox(bool preserveSelection);
    void OpenSelectedMenu(std::size_t selectedMenuIndex);
    void OpenDetail();
    void OpenCompose(std::optional<domain::MessagingUser> recipient, Screen returnScreen);
    void CloseCompose();
    void FocusComposeControl(bool reverse);
    void BindListActivation();
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
    [[nodiscard]] wxString BuildMessageLabel(const domain::MessagingMessage& message) const;
    [[nodiscard]] wxString BuildMessageDetail(const domain::MessagingMessage& message) const;
    static wxString BoxTitle(domain::MessagingBox box);
    [[nodiscard]] std::size_t GetBoxIndex(domain::MessagingBox box) const;

    lila::modules::messaging::application::MessagingService& messagingService_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    Screen currentScreen_ = Screen::Menu;
    Screen screenBeforeCompose_ = Screen::Menu;
    domain::MessagingBox currentBox_ = domain::MessagingBox::Inbox;
    std::optional<std::string> selectedMessageId_;
    std::optional<domain::MessagingUser> composeRecipient_;
    std::size_t lastMenuIndex_ = 0;
    bool isBusy_ = false;
    std::vector<domain::MessagingMessage> boxMessages_;

    wxStaticText* statusLabel_ = nullptr;
    lila::shared::ui::controls::VerticalMenu* menu_ = nullptr;
    wxSimplebook* screenBook_ = nullptr;
    wxPanel* menuPanel_ = nullptr;
    wxPanel* listPanel_ = nullptr;
    wxPanel* detailPanel_ = nullptr;
    wxPanel* composePanel_ = nullptr;

    wxStaticText* listTitleLabel_ = nullptr;
    wxListBox* messagesList_ = nullptr;
    wxTextCtrl* emptyMessagesCtrl_ = nullptr;

    wxTextCtrl* detailCtrl_ = nullptr;
    wxButton* replyButton_ = nullptr;
    wxButton* deleteButton_ = nullptr;
    wxButton* restoreButton_ = nullptr;
    wxButton* purgeButton_ = nullptr;

    wxTextCtrl* recipientCtrl_ = nullptr;
    wxTextCtrl* subjectCtrl_ = nullptr;
    wxTextCtrl* bodyCtrl_ = nullptr;
    wxButton* sendComposeButton_ = nullptr;
    wxButton* cancelComposeButton_ = nullptr;

    std::array<std::optional<std::string>, 3> lastBoxSelection_;
};
}
