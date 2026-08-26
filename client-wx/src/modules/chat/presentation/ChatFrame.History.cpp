#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/chat/presentation/ChatFrame.h"

#include <algorithm>
#include <ctime>

#include <wx/button.h>
#include <wx/datetime.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"
#include "modules/chat/presentation/ChatMessageActions.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"

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

    wxString historyText;
    messageStartPositions_.clear();
    messageStartPositions_.reserve(visibleMessages_.size());
    for (const auto& message : visibleMessages_)
    {
        if (!historyText.empty()) historyText += wxString(L"\n");
        messageStartPositions_.push_back(static_cast<long>(historyText.length()));
        historyText += BuildMessageLabel(message);
    }

    if (visibleMessages_.empty())
    {
        historyCtrl_->SetValue(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatNoMessage));
        historyCtrl_->SetInsertionPointEnd();
    }
    else
    {
        historyCtrl_->SetValue(historyText);
        long insertionPoint = historyCtrl_->GetLastPosition();
        if (previousMessage.has_value())
        {
            for (std::size_t index = 0; index < visibleMessages_.size(); ++index)
            {
                if (!previousMessage->id.empty() && visibleMessages_[index].id == previousMessage->id)
                {
                    insertionPoint = messageStartPositions_[index] +
                        static_cast<long>(BuildMessageLabel(visibleMessages_[index]).length());
                    break;
                }
            }
        }
        historyCtrl_->SetInsertionPoint(insertionPoint);
        historyCtrl_->ShowPosition(insertionPoint);
    }

    SyncActionState();
    Layout();
}

std::optional<domain::ChatMessage> ChatFrame::GetSelectedMessage() const
{
    if (visibleMessages_.empty() || messageStartPositions_.size() != visibleMessages_.size())
    {
        return std::nullopt;
    }

    const long insertionPoint = historyCtrl_->GetInsertionPoint();
    const auto next = std::upper_bound(
        messageStartPositions_.begin(), messageStartPositions_.end(), insertionPoint);
    const std::size_t index = next == messageStartPositions_.begin()
        ? 0
        : static_cast<std::size_t>(std::distance(messageStartPositions_.begin(), next) - 1);
    return visibleMessages_[index];
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

    historyCtrl_->Enable(true);
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

}
}
