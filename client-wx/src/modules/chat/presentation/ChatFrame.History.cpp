#include "shared/text/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"

#include <algorithm>
#include <ctime>

#include <wx/button.h>
#include <wx/datetime.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "modules/chat/presentation/ChatMessageActions.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"
#include "shared/accessibility/AccessibilityUtils.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::RefreshHistory()
{
    const auto previousMessage = GetSelectedMessage();
    visibleMessages_ = chatService_.Messages();
    if (selectedActionMessageId_.has_value()
        && std::none_of(
            visibleMessages_.begin(),
            visibleMessages_.end(),
            [this](const domain::ChatMessage& message)
            {
                return message.id == selectedActionMessageId_.value();
            }))
    {
        selectedActionMessageId_.reset();
        isHistoryActionMode_ = false;
    }

    historyList_->Clear();
    for (const auto& message : visibleMessages_)
    {
        historyList_->Append(BuildMessageLabel(message));
    }

    if (visibleMessages_.empty())
    {
        historyList_->SetSelection(wxNOT_FOUND);
        emptyHistoryCtrl_->Show(true);
        historyList_->Show(false);
    }
    else
    {
        emptyHistoryCtrl_->Show(false);
        historyList_->Show(true);

        int selection = 0;
        if (previousMessage.has_value())
        {
            for (std::size_t index = 0; index < visibleMessages_.size(); ++index)
            {
                if (!previousMessage->id.empty() && visibleMessages_[index].id == previousMessage->id)
                {
                    selection = static_cast<int>(index);
                    break;
                }
            }
        }

        historyList_->SetSelection(selection);
    }

    SyncActionState();
    Layout();
}

std::optional<domain::ChatMessage> ChatFrame::GetSelectedMessage() const
{
    const int selection = historyList_->GetSelection();
    if (selection == wxNOT_FOUND || static_cast<std::size_t>(selection) >= visibleMessages_.size())
    {
        return std::nullopt;
    }

    return visibleMessages_[static_cast<std::size_t>(selection)];
}

bool ChatFrame::CanActOnMessage(const domain::ChatMessage& message) const
{
    return ChatMessageActions::CanActOnMessage(
        message,
        chatService_.EditWindowSeconds(),
        std::time(nullptr));
}

wxString ChatFrame::BuildMessageLabel(const domain::ChatMessage& message) const
{
    const wxDateTime timestamp(static_cast<time_t>(message.timestampUtc));
    const wxString timeLabel = timestamp.IsValid()
        ? timestamp.Format("%H:%M")
        : lila::shared::text::FromUtf8(lila::shared::text::ui::ChatTimeFormatUnknown);
    const std::string_view userText = message.user.empty()
        ? std::string_view(lila::shared::text::ui::ChatUnknownUser)
        : std::string_view(message.user);
    const wxString userLabel = lila::shared::text::FromUtf8(userText);
    const wxString textLabel = lila::shared::text::FromUtf8(message.text);

    wxString label;
    label << timeLabel << wxString(L" - ") << userLabel << wxString(L" : ") << textLabel;

    if (message.isMine && CanActOnMessage(message))
    {
        label << lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditableSuffix);
    }

    return label;
}

void ChatFrame::SyncActionState()
{
    const bool hasMessages = !visibleMessages_.empty();
    const bool editing = pendingEditMessageId_.has_value();
    const auto selectedMessage = GetSelectedMessage();
    const bool selectedMessageIsActionReady =
        selectedMessage.has_value() && selectedActionMessageId_.has_value()
        && selectedMessage->id == selectedActionMessageId_.value()
        && CanActOnMessage(*selectedMessage);
    const bool canAct = selectedMessageIsActionReady;

    historyList_->Enable(hasMessages && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        editMessageButton_,
        canAct && !isBusy_);
    lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(
        deleteMessageButton_,
        canAct && !isBusy_);

    // Keep the text control enabled so it remains visible/focusable to keyboard
    // and screen-reader users while the connection is being established.
    // Read-only state prevents sending/editing until the service is ready.
    inputCtrl_->Enable(true);
    inputCtrl_->SetEditable(!isBusy_ && chatService_.State() == domain::ChatState::Connected);

    if (!editing)
    {
        inputCtrl_->SetHint(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatInputHint));
    }

    if (!hasMessages)
    {
        lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(editMessageButton_, false);
        lila::shared::accessibility::AccessibilityUtils::SetSecondaryActionAvailability(deleteMessageButton_, false);
    }

    if (emptyHistoryCtrl_->IsShown())
    {
        emptyHistoryCtrl_->SetValue(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatNoMessage));
    }
}
}
