#include "shared/text/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/chat/presentation/ChatFocusController.h"
#include "modules/chat/presentation/ChatEventBinder.h"
#include "modules/chat/presentation/ChatEventBinder.inl"
#include "modules/chat/presentation/ChatErrorResolver.h"


#include <wx/button.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/ui/BackgroundTask.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/StringUtils.h"

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

void ChatFrame::BindEvents()
{
    ChatEventBinder::Bind(
        *this,
        ChatEventBinder::Widgets{*inputCtrl_, *historyList_, *editMessageButton_, *deleteMessageButton_},
        ChatEventBinder::Handlers{
            [this]() { SendInput(); },
            [this]()
            {
                selectedActionMessageId_.reset();
                isHistoryActionMode_ = false;
                SyncActionState();
            },
            [this]() { HandleHistoryClick(); },
            [this]() { HandleHistoryActivation(); },
            [this]() { HandleEditSelected(); },
            [this]() { HandleDeleteSelected(); },
            [this]() { HandleEscape(); },
            [this]()
            {
                if (isReturningToSession_)
                {
                    isReturningToSession_ = false;
                    return;
                }
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
    focusController_->BindNavigation(*this, [this]() { return isHistoryActionMode_; });
}

void ChatFrame::HandleHistoryClick()
{
    const int selection = historyList_->GetSelection();
    if (selection == wxNOT_FOUND
        || static_cast<std::size_t>(selection) >= visibleMessages_.size()
        || !CanActOnMessage(visibleMessages_[static_cast<std::size_t>(selection)]))
    {
        selectedActionMessageId_.reset();
        isHistoryActionMode_ = false;
    }
    else
    {
        selectedActionMessageId_ = visibleMessages_[static_cast<std::size_t>(selection)].id;
        isHistoryActionMode_ = true;
    }
    SyncActionState();
}

void ChatFrame::HandleEditSelected()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value() || !CanActOnMessage(*message)
        || !selectedActionMessageId_.has_value() || selectedActionMessageId_.value() != message->id)
    {
        return;
    }

    isHistoryActionMode_ = false;
    BeginEdit(*message);
}

void ChatFrame::HandleDeleteSelected()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value() || !CanActOnMessage(*message)
        || !selectedActionMessageId_.has_value() || selectedActionMessageId_.value() != message->id)
    {
        return;
    }

    const int confirmation = wxMessageBox(
        lila::shared::text::FromUtf8(lila::shared::errors::ChatDeleteConfirm),
        lila::shared::text::FromUtf8(lila::shared::errors::ChatFrameHeader),
        wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
        this);
    if (confirmation != wxYES)
    {
        return;
    }

    isHistoryActionMode_ = false;
    const std::string messageId = message->id;
    RunChatAction(
        lila::shared::text::FromUtf8(lila::shared::errors::ChatDeleteBusy),
        [this, messageId]() { chatService_.Delete(messageId); },
        [this]()
        {
            CancelEdit();
            UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatDeleted));
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
    // Read-only history placeholder remains keyboard reachable while connecting.
    emptyHistoryCtrl_->Enable(true);

    // Do not disable the composer: a disabled wxTextCtrl is skipped by Tab and
    // accessibility tools, which made the history appear to be the first control.
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

    SetBusyState(true, lila::shared::text::FromUtf8(lila::shared::errors::ChatConnecting));
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
        lila::shared::text::FromUtf8(lila::shared::errors::ChatFrameHeader));
}

void ChatFrame::SendInput()
{
    if (isBusy_ || chatService_.State() != domain::ChatState::Connected || !inputCtrl_->IsEditable())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatNotConnected), true);
        focusController_->FocusComposer();
        return;
    }

    wxString trimmedValue = inputCtrl_->GetValue();
    trimmedValue.Trim(true).Trim(false);
    if (trimmedValue.empty())
    {
        return;
    }

    const std::string payload = lila::shared::text::ToUtf8(trimmedValue);
    if (pendingEditMessageId_.has_value())
    {
        const std::string messageId = *pendingEditMessageId_;
        RunChatAction(
            lila::shared::text::FromUtf8(lila::shared::errors::ChatEditBusy),
            [this, messageId, payload]()
            {
                chatService_.Edit(messageId, payload);
            },
            [this]()
            {
                UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatEdited));
                CancelEdit();
            });
    }
    else
    {
        RunChatAction(
            lila::shared::text::FromUtf8(lila::shared::errors::ChatSendBusy),
            [this, payload]()
            {
                chatService_.Send(payload);
            },
            [this]()
            {
                UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatSent));
                inputCtrl_->Clear();
            });
    }

    SyncActionState();
}

void ChatFrame::CancelEdit()
{
    isHistoryActionMode_ = false;
    selectedActionMessageId_.reset();

    if (!pendingEditMessageId_.has_value())
    {
        SyncActionState();
        return;
    }

    pendingEditMessageId_.reset();
    inputCtrl_->Clear();
    inputCtrl_->SetHint(lila::shared::text::FromUtf8(lila::shared::errors::ChatEditHint));
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatEditAborted));
    SyncActionState();
}

void ChatFrame::HandleEscape()
{
    InvalidateOpenChatRequest();

    if (pendingEditMessageId_.has_value())
    {
        CancelEdit();
        focusController_->FocusComposer();
        return;
    }

    if (!ConfirmClose())
    {
        return;
    }

    chatService_.Close();
    RequestCloseToSession();
}

void ChatFrame::HandleHistoryActivation()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value() || !CanActOnMessage(*message))
    {
        return;
    }

    selectedActionMessageId_ = message->id;
    isHistoryActionMode_ = true;
    SyncActionState();

    focusController_->FocusFirstHistoryAction();
}

bool ChatFrame::ConfirmClose()
{
    if (!optionsStore_.Current().confirmChatExit)
    {
        return true;
    }

    const int answer = wxMessageBox(
        lila::shared::text::FromUtf8(lila::shared::errors::ChatCloseConfirmation),
        lila::shared::text::FromUtf8(lila::shared::errors::ChatFrameHeader),
        wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION,
        this);
    return answer == wxYES;
}

void ChatFrame::BeginEdit(const domain::ChatMessage& message)
{
    isHistoryActionMode_ = false;
    pendingEditMessageId_ = message.id;
    inputCtrl_->SetValue(lila::shared::text::FromUtf8(message.text));
    focusController_->FocusComposer();
    inputCtrl_->SelectAll();
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatEditMode));
    SyncActionState();
}
}
