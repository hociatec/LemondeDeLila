#include "modules/chat/presentation/ChatFrame.h"

#include <algorithm>
#include <ctime>

#include <wx/button.h>
#include <wx/datetime.h>
#include <wx/listbox.h>
#include <wx/textctrl.h>

#include "modules/chat/application/ChatService.h"

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
        if (!historyList_->HasFocus() && !inputCtrl_->HasFocus())
        {
            historyList_->SetFocus();
        }
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
    if (!message.isMine || message.id.empty())
    {
        return false;
    }

    const int editWindowSeconds = chatService_.EditWindowSeconds();
    if (editWindowSeconds <= 0)
    {
        return false;
    }

    const std::time_t now = std::time(nullptr);
    const auto age = static_cast<long long>(now - message.timestampUtc);
    return age >= 0 && age <= editWindowSeconds;
}

wxString ChatFrame::BuildMessageLabel(const domain::ChatMessage& message) const
{
    const wxDateTime timestamp(static_cast<time_t>(message.timestampUtc));
    const wxString timeLabel = timestamp.IsValid() ? timestamp.Format("%H:%M") : wxString(L"??:??");
    const wxString userLabel = wxString::FromUTF8(message.user.empty() ? "Inconnu" : message.user);
    const wxString textLabel = wxString::FromUTF8(message.text);

    wxString label;
    label << timeLabel << wxString(L" - ") << userLabel << wxString(L" : ") << textLabel;

    if (message.isMine && CanActOnMessage(message))
    {
        label << wxString(L" - modifiable");
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

    historyList_->Enable(hasMessages);
    editMessageButton_->Enable(canAct);
    deleteMessageButton_->Enable(canAct);
    inputCtrl_->Enable(chatService_.State() == domain::ChatState::Connected);

    if (!editing)
    {
        inputCtrl_->SetHint(wxString(L"Saisissez votre message puis appuyez sur Entrée."));
    }

    if (!hasMessages)
    {
        editMessageButton_->Enable(false);
        deleteMessageButton_->Enable(false);
    }

    if (emptyHistoryCtrl_->IsShown())
    {
        emptyHistoryCtrl_->SetValue(wxString(L"Aucun message."));
    }
}
}
