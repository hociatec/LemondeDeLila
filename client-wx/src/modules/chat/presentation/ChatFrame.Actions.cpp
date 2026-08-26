#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "modules/chat/presentation/ChatFocusController.h"

#include <wx/button.h>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "modules/chat/domain/ChatErrorMessages.h"
#include "shared/text/domain/StringUtils.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::SendInput()
{
    if (isBusy_ || chatService_.State() != domain::ChatState::Connected || !inputCtrl_->IsEditable())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ChatNotConnected), true);
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposerPlan()));
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
    ClearNavigationHistory();
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

    if (NavigateBack())
    {
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
    const auto message = GetSelectedMessage();
    const bool shouldEnterActionMode = message.has_value() && CanActOnMessage(*message);

    if (shouldEnterActionMode && !isHistoryActionMode_)
    {
        PushNavigationSnapshot();
    }

    if (!shouldEnterActionMode)
    {
        ClearNavigationHistory();
        selectedActionMessageId_.reset();
        isHistoryActionMode_ = false;
    }
    else
    {
        selectedActionMessageId_ = message->id;
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

    if (!isHistoryActionMode_)
    {
        PushNavigationSnapshot();
    }
    selectedActionMessageId_ = message->id;
    isHistoryActionMode_ = true;
    SyncActionState();

    static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildFirstHistoryActionPlan()));
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
    if (!optionsStore_.Current().chat.confirmChatExit)
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
    PushNavigationSnapshot();
    isHistoryActionMode_ = false;
    pendingEditMessageId_ = message.id;
    inputCtrl_->SetValue(lila::shared::text::FromUtf8(message.text));
    static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposerPlan()));
    inputCtrl_->SelectAll();
    UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditMode));
    SyncActionState();
}
}
