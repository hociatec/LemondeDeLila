#include "shared/text/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "modules/chat/presentation/ChatFocusController.h"

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/StringUtils.h"
#include "shared/text/UiTexts.h"

namespace lila::modules::chat::presentation
{
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
            lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditBusy),
            [this, messageId, payload]()
            {
                chatService_.Edit(messageId, payload);
            },
            [this]()
            {
                UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEdited));
                CancelEdit();
            });
    }
    else
    {
        RunChatAction(
            lila::shared::text::FromUtf8(lila::shared::text::ui::ChatSendBusy),
            [this, payload]()
            {
                chatService_.Send(payload);
            },
            [this]()
            {
                UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatSent));
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
    inputCtrl_->SetHint(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditHint));
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditAborted));
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
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatDeleteConfirm),
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameHeader),
        wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
        this);
    if (confirmation != wxYES)
    {
        return;
    }

    isHistoryActionMode_ = false;
    const std::string messageId = message->id;
    RunChatAction(
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatDeleteBusy),
        [this, messageId]() { chatService_.Delete(messageId); },
        [this]()
        {
            CancelEdit();
            UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatDeleted));
        });
}

bool ChatFrame::ConfirmClose()
{
    if (!optionsStore_.Current().confirmChatExit)
    {
        return true;
    }

    const int answer = wxMessageBox(
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatCloseConfirmation),
        lila::shared::text::FromUtf8(lila::shared::text::ui::ChatFrameHeader),
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
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditMode));
    SyncActionState();
}
}
