#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "modules/chat/presentation/ChatErrorResolver.h"
#include "modules/chat/presentation/ChatFocusController.h"

#include <wx/button.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/domain/StringUtils.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/ui/application/BackgroundTask.h"

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

    historyCtrl_->Enable(true);
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

    static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposerPlan()));
}

void ChatFrame::OpenChat()
{
    if (isBusy_)
    {
        return;
    }

    SetBusyState(true, lila::shared::text::FromUtf8(lila::shared::text::ui::ChatConnecting));
    static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposerPlan()));
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
            static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposerPlan()));
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
    wxBell();
    ShowAccessibleErrorDialog(
        lila::shared::text::FromUtf8(safeMessage),
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameHeader));
}
}
