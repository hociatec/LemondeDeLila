#include "shared/text/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/chat/presentation/ChatErrorResolver.h"
#include "modules/chat/presentation/ChatFocusController.h"

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/StringUtils.h"
#include "shared/text/UiTexts.h"
#include "shared/ui/BackgroundTask.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::RunChatAction(
    const wxString& busyMessage,
    const std::function<void()>& action,
    const std::function<void()>& onSuccess)
{
    if (isBusy_)
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    SetBusyState(true, busyMessage);
    wxWeakRef<ChatFrame> weakSelf(this);
    lila::shared::ui::RunBackgroundTask(
        this,
        action,
        [weakSelf, onSuccess](std::string errorMessage) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            weakSelf->SetBusyState(false);
            if (!errorMessage.empty())
            {
                weakSelf->UpdateStatus(lila::shared::text::FromUtf8(errorMessage), true);
                return;
            }

            if (onSuccess)
            {
                onSuccess();
            }
        });
}

void ChatFrame::SetBusyState(bool isBusy, const wxString& statusMessage)
{
    isBusy_ = isBusy;

    if (isBusy && !statusMessage.empty())
    {
        UpdateStatus(statusMessage);
    }

    if (!isBusy)
    {
        RefreshHistory();
    }

    historyList_->Enable(!isBusy && !visibleMessages_.empty());
    emptyHistoryCtrl_->Enable(true);
    inputCtrl_->Enable(true);
    inputCtrl_->SetEditable(!isBusy && chatService_.State() == domain::ChatState::Connected);
    if (isBusy)
    {
        editMessageButton_->Enable(false);
        deleteMessageButton_->Enable(false);
    }
    else
    {
        SyncActionState();
    }

    focusController_->FocusComposer();
}

void ChatFrame::OpenChat()
{
    if (isBusy_)
    {
        return;
    }

    SetBusyState(true, lila::shared::text::FromUtf8(lila::shared::text::ui::ChatConnecting));
    focusController_->FocusComposer();
    InvalidateOpenChatRequest();
    const std::size_t requestId = activeOpenChatRequestId_;
    auto* service = &chatService_;

    openChatTask_ = lila::shared::ui::RunBackgroundTaskWithResult<bool>(
        this,
        [service]() { return service->Open(); },
        [this, requestId](std::string errorMessage, std::optional<bool> connectedResult)
        {
            if (activeOpenChatRequestId_ != requestId)
            {
                return;
            }
            openChatTask_.reset();
            SetBusyState(false);

            if (!errorMessage.empty())
            {
                PresentConnectionError(ChatErrorResolver::Resolve(errorMessage, chatService_.LastServerError()));
                return;
            }

            const bool connected = connectedResult.value_or(false);
            if (!connected)
            {
                const auto statusMessage = lila::shared::text::TrimCopy(chatService_.StatusMessage());
                const std::string fallbackMessage = lila::shared::errors::WithDetails(
                    lila::shared::errors::ChatConnectionFailed,
                    lila::shared::errors::UnexpectedError);
                PresentConnectionError(ChatErrorResolver::Resolve(
                    statusMessage.empty() ? fallbackMessage : statusMessage,
                    chatService_.LastServerError()));
                return;
            }

            RefreshHistory();
            SyncActionState();
            focusController_->FocusComposer();
        });
}

void ChatFrame::PresentConnectionError(const std::string& message)
{
    const std::string safeMessage = message.empty()
        ? lila::shared::errors::WithDetails(
            lila::shared::errors::ChatConnectionFailed,
            lila::shared::errors::UnexpectedError)
        : message;
    UpdateStatus(lila::shared::text::FromUtf8(safeMessage), true);
    if (statusLabel_ != nullptr)
    {
        statusLabel_->SetFocus();
    }
    wxBell();
    ShowAccessibleErrorDialog(
        lila::shared::text::FromUtf8(safeMessage),
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameHeader));
}
}
