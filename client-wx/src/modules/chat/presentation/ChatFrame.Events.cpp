#include "modules/chat/presentation/ChatFrame.h"

#include <wx/button.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/app.h>
#include <wx/weakref.h>

#include "modules/chat/application/ChatService.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/ui/BackgroundTask.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::RunChatAction(
    const wxString& busyMessage,
    const std::function<void()>& action,
    const std::function<void()>& onSuccess)
{
    if (isBusy_)
    {
        UpdateStatus(wxString::FromUTF8(lila::shared::errors::ActionInProgress), true);
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
                weakSelf->UpdateStatus(wxString::FromUTF8(errorMessage), true);
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
    inputCtrl_->Bind(
        wxEVT_TEXT_ENTER,
        [this](wxCommandEvent&)
        {
            SendInput();
        });
    historyList_->Bind(
        wxEVT_LISTBOX,
        [this](wxCommandEvent&)
        {
            selectedActionMessageId_.reset();
            isHistoryActionMode_ = false;
            SyncActionState();
        });
    historyList_->Bind(
        wxEVT_LEFT_UP,
        [this](wxMouseEvent& event)
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
            event.Skip();
        });
    historyList_->Bind(
        wxEVT_LISTBOX_DCLICK,
        [this](wxCommandEvent&)
        {
            HandleHistoryActivation();
        });
    editMessageButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            const auto message = GetSelectedMessage();
            if (!message.has_value() || !CanActOnMessage(*message))
            {
                return;
            }

            if (!selectedActionMessageId_.has_value() || selectedActionMessageId_.value() != message->id)
            {
                return;
            }

            isHistoryActionMode_ = false;
            BeginEdit(*message);
        });
    deleteMessageButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            const auto message = GetSelectedMessage();
            if (!message.has_value() || !CanActOnMessage(*message))
            {
                return;
            }

            if (!selectedActionMessageId_.has_value() || selectedActionMessageId_.value() != message->id)
            {
                return;
            }

            const int confirmation = wxMessageBox(
                wxString(L"Supprimer ce message ?"),
                wxString(L"Tchat"),
                wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
                this);
            if (confirmation == wxYES)
            {
                isHistoryActionMode_ = false;
                const std::string messageId = message->id;
                RunChatAction(
                    wxString(L"Suppression du message..."),
                    [this, messageId]()
                    {
                        chatService_.Delete(messageId);
                    },
                    [this]()
                    {
                        CancelEdit();
                        UpdateStatus(wxString(L"Message supprimé."));
                    });
            }
        });

    inputCtrl_->Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                HandleEscape();
                return;
            }
            if (event.GetKeyCode() == WXK_TAB && pendingEditMessageId_.has_value())
            {
                return;
            }
            event.Skip();
        });

    historyList_->Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                HandleEscape();
                return;
            }

            if (event.GetKeyCode() == WXK_RETURN || event.GetKeyCode() == WXK_NUMPAD_ENTER)
            {
                HandleHistoryActivation();
                return;
            }

            event.Skip();
        });

    Bind(
        wxEVT_CHAR_HOOK,
        [this](wxKeyEvent& event)
        {
            if (event.GetKeyCode() == WXK_TAB && pendingEditMessageId_.has_value())
            {
                return;
            }

            if (event.GetKeyCode() == WXK_TAB && isHistoryActionMode_)
            {
                FocusHistoryAction(event.ShiftDown());
                return;
            }

            if (event.GetKeyCode() == WXK_ESCAPE)
            {
                HandleEscape();
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

            event.Skip(false);
            if (isReturningToSession_)
            {
                isReturningToSession_ = false;
                return;
            }

            if (onExitRequested_)
            {
                onExitRequested_();
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

    historyList_->Enable(!isBusy);
    emptyHistoryCtrl_->Enable(!isBusy);
    inputCtrl_->Enable(!isBusy && chatService_.State() == domain::ChatState::Connected);
    if (isBusy)
    {
        editMessageButton_->Enable(false);
        deleteMessageButton_->Enable(false);
    }
    else
    {
        SyncActionState();
    }

    historyList_->SetFocus();
}

void ChatFrame::OpenChat()
{
    if (isBusy_)
    {
        return;
    }

    SetBusyState(true, wxString(L"Connexion au serveur..."));
    InvalidateOpenChatRequest();
    const std::size_t requestId = activeOpenChatRequestId_;
    wxWeakRef<ChatFrame> weakSelf(this);
    lila::shared::ui::RunDetachedBackgroundTask(
        [weakSelf, requestId]()
        {
            bool connected = false;
            std::string errorMessage;
            if (wxTheApp == nullptr)
            {
                return;
            }

            if (weakSelf)
            {
                try
                {
                    connected = weakSelf->chatService_.Open();
                }
                catch (const std::exception& error)
                {
                    errorMessage = error.what();
                }
                catch (...)
                {
                    errorMessage = lila::shared::ui::UnexpectedErrorMessage;
                }
            }

            wxTheApp->CallAfter(
                [weakSelf, connected, requestId, errorMessage = std::move(errorMessage)]() mutable
                {
                    if (!weakSelf)
                    {
                        return;
                    }

                    if (weakSelf->activeOpenChatRequestId_ != requestId)
                    {
                        return;
                    }

                    weakSelf->SetBusyState(false);
                    if (!errorMessage.empty())
                    {
                        weakSelf->UpdateStatus(wxString::FromUTF8(errorMessage), true);
                        wxMessageBox(
                            wxString::FromUTF8(errorMessage),
                            wxString(L"Tchat"),
                            wxOK | wxICON_INFORMATION,
                            weakSelf);

                        weakSelf->RequestCloseToSession();

                        return;
                    }

                    if (!connected)
                    {
                        weakSelf->UpdateStatus(wxString::FromUTF8(weakSelf->chatService_.StatusMessage()), true);
                        wxMessageBox(
                            wxString::FromUTF8(weakSelf->chatService_.StatusMessage()),
                            wxString(L"Tchat"),
                            wxOK | wxICON_INFORMATION,
                            weakSelf);
                        weakSelf->RequestCloseToSession();
                        return;
                    }

                    weakSelf->RefreshHistory();
                    weakSelf->SyncActionState();
                    weakSelf->inputCtrl_->SetFocus();
                });
        });
}

void ChatFrame::SendInput()
{
    wxString trimmedValue = inputCtrl_->GetValue();
    trimmedValue.Trim(true).Trim(false);
    if (trimmedValue.empty())
    {
        return;
    }

    const std::string payload = trimmedValue.ToUTF8().data();
    if (pendingEditMessageId_.has_value())
    {
        const std::string messageId = *pendingEditMessageId_;
        RunChatAction(
            wxString(L"Modification du message..."),
            [this, messageId, payload]()
            {
                chatService_.Edit(messageId, payload);
            },
            [this]()
            {
                UpdateStatus(wxString(L"Modification envoyée."));
                CancelEdit();
            });
    }
    else
    {
        RunChatAction(
            wxString(L"Envoi du message..."),
            [this, payload]()
            {
                chatService_.Send(payload);
            },
            [this]()
            {
                UpdateStatus(wxString(L"Message envoyé."));
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
    inputCtrl_->SetHint(wxString(L"Saisissez votre message puis appuyez sur Entrée."));
    UpdateStatus(wxString(L"Édition annulée."));
    SyncActionState();
}

void ChatFrame::HandleEscape()
{
    InvalidateOpenChatRequest();

    if (pendingEditMessageId_.has_value())
    {
        CancelEdit();
        inputCtrl_->SetFocus();
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

    if (editMessageButton_ != nullptr)
    {
        editMessageButton_->SetFocus();
    }
}

void ChatFrame::FocusHistoryAction(bool isReverse)
{
    if (!isHistoryActionMode_ || !selectedActionMessageId_.has_value())
    {
        return;
    }

    wxWindow* actionControls[2] = {editMessageButton_, deleteMessageButton_};
    int currentIndex = 0;
    wxWindow* focusedWindow = FindFocus();
    for (std::size_t index = 0; index < 2; ++index)
    {
        if (focusedWindow == actionControls[index])
        {
            currentIndex = static_cast<int>(index);
            break;
        }
    }

    int nextIndex;
    if (isReverse)
    {
        nextIndex = (currentIndex + 1) % 2;
    }
    else
    {
        nextIndex = (currentIndex + 1) % 2;
    }

    if (actionControls[nextIndex] != nullptr)
    {
        actionControls[nextIndex]->SetFocus();
    }
}

bool ChatFrame::ConfirmClose()
{
    if (!optionsStore_.Current().confirmChatExit)
    {
        return true;
    }

    const int answer = wxMessageBox(
        wxString(L"Fermer le tchat ?"),
        wxString(L"Tchat"),
        wxYES_NO | wxNO_DEFAULT | wxICON_QUESTION,
        this);
    return answer == wxYES;
}

void ChatFrame::BeginEdit(const domain::ChatMessage& message)
{
    isHistoryActionMode_ = false;
    pendingEditMessageId_ = message.id;
    inputCtrl_->SetValue(wxString::FromUTF8(message.text));
    inputCtrl_->SetFocus();
    inputCtrl_->SelectAll();
    UpdateStatus(wxString(L"Édition du message."));
    SyncActionState();
}
}
