#include "modules/messaging/presentation/MessagingFrame.h"

#include <algorithm>
#include <array>
#include <ctime>
#include <memory>
#include <vector>

#include <wx/button.h>
#include <wx/datetime.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/messaging/application/MessagingService.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::messaging::presentation
{
void MessagingFrame::FocusComposeControl(bool reverse)
{
    const std::array<wxWindow*, 5> controls = {
        recipientCtrl_,
        subjectCtrl_,
        bodyCtrl_,
        sendComposeButton_,
        cancelComposeButton_};

    int currentIndex = 0;
    const wxWindow* focused = wxWindow::FindFocus();
    for (std::size_t index = 0; index < controls.size(); ++index)
    {
        if (controls[index] == focused)
        {
            currentIndex = static_cast<int>(index);
            break;
        }
    }

    const int direction = reverse ? -1 : 1;
    const int count = static_cast<int>(controls.size());
    const int nextIndex = (currentIndex + direction + count) % count;
    if (controls[static_cast<std::size_t>(nextIndex)] != nullptr)
    {
        controls[static_cast<std::size_t>(nextIndex)]->SetFocus();
    }
}

void MessagingFrame::BindEvents()
{
    if (menu_ == nullptr)
    {
        return;
    }

    lila::shared::ui::navigation::BindMenuHandlers(
        *menu_,
        [this](std::size_t index)
        {
            lastMenuIndex_ = index;
        },
        [this](std::size_t index)
        {
            OpenSelectedMenu(index);
        });

    BindListActivation();

    replyButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { ReplyToSelectedMessage(); });
    deleteButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { DeleteSelectedMessage(); });
    restoreButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { RestoreSelectedMessage(); });
    purgeButton_->Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { PurgeSelectedMessage(); });
    sendComposeButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            SendComposedMessage();
        });
    cancelComposeButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            CloseCompose();
        });
    bodyCtrl_->Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            if (!isBusy_ && (key == WXK_RETURN || key == WXK_NUMPAD_ENTER) && !event.ShiftDown() && !event.ControlDown())
            {
                SendComposedMessage();
                return;
            }

            event.Skip();
        });

    const auto bindComposeTabLoop = [this](wxWindow* control)
    {
        control->Bind(
            wxEVT_CHAR_HOOK,
            [this](wxKeyEvent& event)
            {
                if (event.GetKeyCode() != WXK_TAB)
                {
                    event.Skip();
                    return;
                }

                if (currentScreen_ != Screen::Compose)
                {
                    event.Skip();
                    return;
                }

                FocusComposeControl(event.ShiftDown());
            });
    };

    bindComposeTabLoop(recipientCtrl_);
    bindComposeTabLoop(subjectCtrl_);
    bindComposeTabLoop(bodyCtrl_);
    bindComposeTabLoop(sendComposeButton_);
    bindComposeTabLoop(cancelComposeButton_);

    Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
        if (key == WXK_ESCAPE)
        {
            switch (currentScreen_)
            {
                case Screen::Menu:
                    if (onCloseRequested_)
                    {
                        onCloseRequested_();
                    }
                    return;
                case Screen::List:
                    SetScreen(Screen::Menu);
                    return;
                case Screen::Detail:
                    SetScreen(Screen::List);
                    return;
                case Screen::Compose:
                    CloseCompose();
                    return;
            }
        }

        if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
        {
            if (currentScreen_ == Screen::Menu && menu_ != nullptr)
            {
                OpenSelectedMenu(menu_->GetSelectedIndex());
                return;
            }

            if (currentScreen_ == Screen::List)
            {
                OpenDetail();
                return;
            }
        }

        if (key == WXK_TAB && currentScreen_ == Screen::Detail)
        {
            std::vector<wxWindow*> controls;
            if (detailCtrl_ != nullptr)
                {
                    controls.push_back(detailCtrl_);
                }
                if (replyButton_ != nullptr && replyButton_->IsShown())
                {
                    controls.push_back(replyButton_);
                }
                if (deleteButton_ != nullptr && deleteButton_->IsShown())
                {
                    controls.push_back(deleteButton_);
                }
                if (restoreButton_ != nullptr && restoreButton_->IsShown())
                {
                    controls.push_back(restoreButton_);
                }
                if (purgeButton_ != nullptr && purgeButton_->IsShown())
                {
                    controls.push_back(purgeButton_);
                }

                if (controls.empty())
                {
                    return;
                }

                int currentIndex = 0;
                const wxWindow* focused = wxWindow::FindFocus();
                for (std::size_t index = 0; index < controls.size(); ++index)
                {
                    if (controls[index] == focused)
                    {
                        currentIndex = static_cast<int>(index);
                        break;
                    }
                }

                const bool reverse = event.ShiftDown();
                const int count = static_cast<int>(controls.size());
                const int direction = reverse ? -1 : 1;
                const int nextIndex = (currentIndex + direction + count) % count;
                controls[static_cast<std::size_t>(nextIndex)]->SetFocus();
                return;
            }

            if (key == WXK_TAB && currentScreen_ == Screen::Compose)
            {
                FocusComposeControl(event.ShiftDown());
                return;
            }

            if (key == WXK_TAB)
            {
                return;
            }

            event.Skip();
        });

    Bind(
        wxEVT_CLOSE_WINDOW,
        [this](wxCloseEvent& event)
        {
            if (event.CanVeto())
            {
                event.Veto();
            }

            if (onExitRequested_)
            {
                onExitRequested_();
            }
        });
}

void MessagingFrame::FocusCurrentScreen()
{
    switch (currentScreen_)
    {
    case Screen::Menu:
        if (menu_ != nullptr)
        {
            menu_->SetSelectedIndex(lastMenuIndex_);
            menu_->FocusSelectedItem();
        }
        return;
    case Screen::List:
        if (messagesList_->GetCount() > 0)
        {
            if (messagesList_->GetSelection() == wxNOT_FOUND)
            {
                messagesList_->SetSelection(0);
                SyncSelectionState();
            }

            if (wxWindow::FindFocus() != messagesList_)
            {
                messagesList_->SetFocus();
            }
        }
        else
        {
            if (wxWindow::FindFocus() != emptyMessagesCtrl_)
            {
                emptyMessagesCtrl_->SetFocus();
            }
        }
        return;
    case Screen::Detail:
        detailCtrl_->SetFocus();
        return;
    case Screen::Compose:
        recipientCtrl_->SetFocus();
        return;
    }
}

void MessagingFrame::RefreshCurrentBox(bool preserveSelection)
{
    LoadBox(currentBox_, preserveSelection);
}

void MessagingFrame::OpenSelectedMenu(std::size_t selectedMenuIndex)
{
    lastMenuIndex_ = selectedMenuIndex;

    if (selectedMenuIndex == 0)
    {
        OpenCompose(std::nullopt, Screen::Menu);
        return;
    }

    if (selectedMenuIndex == 1)
    {
        currentBox_ = domain::MessagingBox::Inbox;
        LoadBox(currentBox_, false);
        return;
    }

    if (selectedMenuIndex == 2)
    {
        currentBox_ = domain::MessagingBox::Outbox;
        LoadBox(currentBox_, false);
        return;
    }

    if (selectedMenuIndex == 3)
    {
        currentBox_ = domain::MessagingBox::Deleted;
        LoadBox(currentBox_, false);
        return;
    }
}

void MessagingFrame::OpenDetail()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value())
    {
        return;
    }

    SetScreen(Screen::Detail);
    if (!message->isSent)
    {
        MarkSelectedMessageRead();
    }
}

void MessagingFrame::OpenCompose(std::optional<domain::MessagingUser> recipient, Screen returnScreen)
{
    screenBeforeCompose_ = returnScreen;
    composeRecipient_ = recipient;
    recipientCtrl_->SetValue(recipient.has_value() ? wxString::FromUTF8(recipient->username) : wxString());
    subjectCtrl_->SetValue(wxEmptyString);
    bodyCtrl_->SetValue(wxEmptyString);
    SetScreen(Screen::Compose);
}

void MessagingFrame::CloseCompose()
{
    composeRecipient_.reset();
    recipientCtrl_->SetValue(wxEmptyString);
    subjectCtrl_->SetValue(wxEmptyString);
    bodyCtrl_->SetValue(wxEmptyString);
    SetScreen(screenBeforeCompose_);
}

void MessagingFrame::BindListActivation()
{
    messagesList_->Bind(
        wxEVT_LISTBOX,
        [this](wxCommandEvent&)
        {
            const auto selected = GetSelectedMessage();
            selectedMessageId_ = selected.has_value() ? std::optional<std::string>(selected->id) : std::nullopt;
            SyncSelectionState();
        });

    messagesList_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&)
        {
            OpenDetail();
        });

    messagesList_->Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
            {
                OpenDetail();
                return;
            }

            if (key == WXK_DELETE)
            {
                if (currentBox_ == domain::MessagingBox::Deleted)
                {
                    PurgeSelectedMessage();
                }
                else
                {
                    DeleteSelectedMessage();
                }
                return;
            }

            event.Skip();
        });
    messagesList_->Bind(
        wxEVT_KEY_DOWN,
        [this](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
            {
                OpenDetail();
                return;
            }

            if (key == WXK_DELETE)
            {
                if (currentBox_ == domain::MessagingBox::Deleted)
                {
                    PurgeSelectedMessage();
                }
                else
                {
                    DeleteSelectedMessage();
                }
                return;
            }

            event.Skip();
        });
}

void MessagingFrame::LoadBox(domain::MessagingBox box, bool preserveSelection)
{
    auto results = std::make_shared<std::vector<domain::MessagingMessage>>();
    const auto previousSelection = selectedMessageId_;
    RunBackgroundTask(
        wxString(L"Chargement de la boîte de réception..."),
        [this, results, box]()
        {
            *results = messagingService_.LoadBox(box);
        },
        [this, results, box, preserveSelection, previousSelection]()
        {
            const wxString title = BoxTitle(box);
            currentBox_ = box;
            boxMessages_ = std::move(*results);
            messagesList_->Clear();

            for (const auto& message : boxMessages_)
            {
                messagesList_->Append(BuildMessageLabel(message));
            }

            listTitleLabel_->SetLabel(title);
            selectedMessageId_ = preserveSelection ? previousSelection : std::nullopt;

            if (selectedMessageId_.has_value())
            {
                for (std::size_t index = 0; index < boxMessages_.size(); ++index)
                {
                    if (boxMessages_[index].id == *selectedMessageId_)
                    {
                        messagesList_->SetSelection(static_cast<int>(index));
                        break;
                    }
                }
            }

            if (messagesList_->GetSelection() == wxNOT_FOUND && !boxMessages_.empty())
            {
                messagesList_->SetSelection(0);
                selectedMessageId_ = boxMessages_.front().id;
            }

    if (boxMessages_.empty())
    {
                UpdateStatus(wxString::FromUTF8(lila::shared::errors::MessagingLoadResultsEmpty));
    }
    else
    {
                UpdateStatus(
                    wxString::Format(
                        wxString::FromUTF8(lila::shared::errors::MessagingLoadResultsCount),
                        boxMessages_.size()));
    }

            SetScreen(Screen::List);
        });
}

void MessagingFrame::SendComposedMessage()
{
    wxString recipientName = recipientCtrl_->GetValue();
    recipientName.Trim(true).Trim(false);
    wxString subject = subjectCtrl_->GetValue();
    subject.Trim(true).Trim(false);
    wxString body = bodyCtrl_->GetValue();
    body.Trim(true).Trim(false);

    if (recipientName.empty())
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::MessagingRecipientRequired), true);
        recipientCtrl_->SetFocus();
        return;
    }

    if (body.empty())
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::MessagingBodyRequired), true);
        bodyCtrl_->SetFocus();
        return;
    }

    auto recipient = std::make_shared<std::optional<domain::MessagingUser>>();
    auto sentMessage = std::make_shared<std::optional<domain::MessagingMessage>>();
    RunBackgroundTask(
        wxString(L"Envoi du message..."),
        [this, recipient, sentMessage, recipientName, subject, body]()
        {
            *recipient = messagingService_.SearchUser(recipientName.ToUTF8().data());
            if (!recipient->has_value())
            {
                throw std::runtime_error(lila::shared::errors::MessagingRecipientNotFound);
            }

            *sentMessage = messagingService_.Send(
                (*recipient)->id,
                body.ToUTF8().data(),
                subject.empty() ? std::optional<std::string>() : std::optional<std::string>(subject.ToUTF8().data()));
        },
        [this, recipient, sentMessage]()
        {
            if (!recipient->has_value() || !sentMessage->has_value())
            {
                UpdateStatus(wxString::FromUTF8(lila::shared::errors::MessagingSendFailed), true);
                return;
            }

            const wxString userLabel = wxString::FromUTF8((*recipient)->username);
            const wxString confirmation = wxString::Format(
                wxString(L"Message envoyé à %s."),
                userLabel);
            UpdateStatus(confirmation);
            wxMessageBox(
                confirmation,
                wxString(L"Messagerie"),
                wxOK | wxICON_INFORMATION,
                this);
            if (currentBox_ != domain::MessagingBox::Outbox)
            {
                currentBox_ = domain::MessagingBox::Outbox;
            }
            CloseCompose();
            LoadBox(currentBox_, false);
        });
}

void MessagingFrame::DeleteSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value())
    {
        return;
    }

    if (wxMessageBox(
            wxString(L"Voulez-vous vraiment supprimer ce message ?"),
            wxString(L"Messagerie"),
            wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION,
            this) != wxYES)
    {
        return;
    }

    RunBackgroundTask(
        wxString(L"Suppression du message..."),
        [this, message]()
        {
            static_cast<void>(messagingService_.Delete(message->id));
        },
        [this]()
        {
            const wxString confirmation = wxString(L"Message supprimé.");
            UpdateStatus(confirmation);
            wxMessageBox(confirmation, wxString(L"Messagerie"), wxOK | wxICON_INFORMATION, this);
            RefreshCurrentBox(false);
        });
}

void MessagingFrame::RestoreSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value())
    {
        return;
    }

    RunBackgroundTask(
        wxString(L"Restauration du message..."),
        [this, message]()
        {
            static_cast<void>(messagingService_.Restore(message->id));
        },
        [this]()
        {
            const wxString confirmation = wxString(L"Message restauré.");
            UpdateStatus(confirmation);
            wxMessageBox(confirmation, wxString(L"Messagerie"), wxOK | wxICON_INFORMATION, this);
            RefreshCurrentBox(false);
        });
}

void MessagingFrame::PurgeSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value())
    {
        return;
    }

    if (wxMessageBox(
            wxString(L"Cette action supprime définitivement le message. Continuer ?"),
            wxString(L"Messagerie"),
            wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
            this) != wxYES)
    {
        return;
    }

    RunBackgroundTask(
        wxString(L"Suppression définitive du message..."),
        [this, message]()
        {
            static_cast<void>(messagingService_.Purge(message->id));
        },
        [this]()
        {
            const wxString confirmation = wxString(L"Message supprimé définitivement.");
            UpdateStatus(confirmation);
            wxMessageBox(confirmation, wxString(L"Messagerie"), wxOK | wxICON_INFORMATION, this);
            RefreshCurrentBox(false);
        });
}

void MessagingFrame::ReplyToSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value())
    {
        return;
    }

    const domain::MessagingUser recipient = message->isSent ? message->recipient : message->sender;
    OpenCompose(recipient, Screen::Detail);
    const wxString subject = wxString::FromUTF8(message->subject);
    subjectCtrl_->SetValue(
        subject.StartsWith(wxString(L"Re: ")) ? subject : wxString(L"Re: ") + subject);
}

void MessagingFrame::MarkSelectedMessageRead()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value() || message->isSent || message->id.empty())
    {
        return;
    }

    RunBackgroundTask(
        wxString(L"Marquage du message comme lu..."),
        [this, message]()
        {
            messagingService_.MarkRead(message->id);
        });
}

std::optional<domain::MessagingMessage> MessagingFrame::GetSelectedMessage() const
{
    const int selection = messagesList_->GetSelection();
    if (selection == wxNOT_FOUND || static_cast<std::size_t>(selection) >= boxMessages_.size())
    {
        return std::nullopt;
    }

    return boxMessages_[static_cast<std::size_t>(selection)];
}

wxString MessagingFrame::BuildMessageLabel(const domain::MessagingMessage& message) const
{
    const wxDateTime timestamp(static_cast<time_t>(message.createdAtUtc));
    const wxString timeLabel = timestamp.IsValid()
        ? timestamp.Format("%d/%m %H:%M")
        : wxString::FromUTF8("Inconnu");
    const wxString userLabel = wxString::FromUTF8(message.isSent ? message.recipient.username : message.sender.username);
    const wxString subject = wxString::FromUTF8(message.subject.empty() ? "Sans sujet" : message.subject);
    return timeLabel + wxString(L" - ") + userLabel + wxString(L" - ") + subject;
}

wxString MessagingFrame::BuildMessageDetail(const domain::MessagingMessage& message) const
{
    const wxDateTime timestamp(static_cast<time_t>(message.createdAtUtc));
    wxString text;
    text << wxString::FromUTF8("Sujet : ")
         << wxString::FromUTF8(message.subject.empty() ? "Sans sujet" : message.subject)
         << wxString::FromUTF8("\nDe : ")
         << wxString::FromUTF8(message.sender.username)
         << wxString::FromUTF8("\nÀ : ")
         << wxString::FromUTF8(message.recipient.username)
         << wxString::FromUTF8("\nDate : ")
         << (timestamp.IsValid() ? timestamp.Format("%d/%m/%Y %H:%M") : wxString::FromUTF8("Inconnu"))
         << wxString::FromUTF8("\n\nContenu :\n")
         << wxString::FromUTF8(message.text);
    return text;
}

void MessagingFrame::SaveCurrentBoxSelection()
{
    if (messagesList_->GetSelection() == wxNOT_FOUND || boxMessages_.empty())
    {
        return;
    }

    const std::size_t index = GetBoxIndex(currentBox_);
    if (index >= lastBoxSelection_.size())
    {
        return;
    }

    const int selected = messagesList_->GetSelection();
    if (selected >= 0 && static_cast<std::size_t>(selected) < boxMessages_.size())
    {
        lastBoxSelection_[index] = boxMessages_[static_cast<std::size_t>(selected)].id;
    }
}

void MessagingFrame::RestoreCurrentBoxSelection()
{
    const std::size_t index = GetBoxIndex(currentBox_);
    if (index >= lastBoxSelection_.size())
    {
        return;
    }

    if (!lastBoxSelection_[index].has_value())
    {
        return;
    }

    const std::string& messageId = *lastBoxSelection_[index];
    for (std::size_t i = 0; i < boxMessages_.size(); ++i)
    {
        if (boxMessages_[i].id == messageId)
        {
            messagesList_->SetSelection(static_cast<int>(i));
            return;
        }
    }

    if (!boxMessages_.empty())
    {
        messagesList_->SetSelection(0);
    }
}
}
