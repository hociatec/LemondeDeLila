#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingActionController.h"
#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "modules/messaging/presentation/MessagingEventBinder.h"
#include "modules/messaging/presentation/MessagingEventBinder.inl"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <algorithm>
#include <array>
#include <memory>
#include <vector>

#include <wx/button.h>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/msgdlg.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/messaging/application/MessagingService.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/accessibility/FocusNavigation.h"

namespace lila::modules::messaging::presentation
{
void MessagingFrame::BindEvents()
{
    MessagingEventBinder::Bind(
        *this,
        *view_,
        navigationState_,
        *focusController_,
        MessagingEventBinder::Handlers{
            [this](std::size_t index) { navigationState_.lastMenuIndex = index; },
            [this](std::size_t index) { OpenSelectedMenu(index); },
            [this]() { SyncSelectionState(); },
            [this]() { OpenDetail(); },
            [this]() { ReplyToSelectedMessage(); },
            [this]() { DeleteSelectedMessage(); },
            [this]() { RestoreSelectedMessage(); },
            [this]() { PurgeSelectedMessage(); },
            [this]() { SendComposedMessage(); },
            [this]() { return !isBusy_; },
            [this]() { CloseCompose(); },
            [this]() { SetScreen(Screen::Menu); },
            [this]() { SetScreen(Screen::List); },
            [this]()
            {
                if (onCloseRequested_)
                {
                    onCloseRequested_();
                }
            },
            [this]()
            {
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
}

void MessagingFrame::RefreshCurrentBox(bool preserveSelection)
{
    LoadBox(navigationState_.currentBox, preserveSelection);
}

void MessagingFrame::OpenSelectedMenu(std::size_t selectedMenuIndex)
{
    navigationState_.lastMenuIndex = selectedMenuIndex;
    if (selectedMenuIndex == 0)
    {
        OpenCompose(std::nullopt, Screen::Menu);
        return;
    }

    const auto box = domain::MessagingBoxFromMenuIndex(selectedMenuIndex);
    if (!box.has_value())
    {
        return;
    }

    navigationState_.SelectBox(*box);
    LoadBox(navigationState_.currentBox, false);
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
    navigationState_.screenBeforeCompose = returnScreen;
    view_->recipientCtrl->SetValue(recipient.has_value() ? lila::shared::text::FromUtf8(recipient->username) : wxString());
    view_->subjectCtrl->SetValue(wxEmptyString);
    view_->bodyCtrl->SetValue(wxEmptyString);
    SetScreen(Screen::Compose);
}

void MessagingFrame::CloseCompose()
{
    view_->recipientCtrl->SetValue(wxEmptyString);
    view_->subjectCtrl->SetValue(wxEmptyString);
    view_->bodyCtrl->SetValue(wxEmptyString);
    SetScreen(navigationState_.screenBeforeCompose);
}

void MessagingFrame::LoadBox(domain::MessagingBox box, bool preserveSelection)
{
    if (preserveSelection && box == navigationState_.currentBox)
    {
        SaveCurrentBoxSelection();
    }
    else if (!preserveSelection)
    {
        selectionMemory_.Clear(box);
    }

    auto results = std::make_shared<std::vector<domain::MessagingMessage>>();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::MessagingLoadMessagesBusy),
        [this, results, box]()
        {
            *results = mailboxController_->LoadBox(box);
        },
        [this, results, box]()
        {
            navigationState_.currentBox = box;
            boxMessages_ = std::move(*results);
            view_->messagesList->Clear();

            for (const auto& message : boxMessages_)
            {
                view_->messagesList->Append(MessagingPresentationModel::BuildMessageLabel(message));
            }

            view_->listTitleLabel->SetLabel(MessagingPresentationModel::BoxTitle(box));
            const auto restoreIndex = selectionMemory_.ResolveIndex(box, boxMessages_);
            if (restoreIndex.has_value())
            {
                view_->messagesList->SetSelection(static_cast<int>(*restoreIndex));
                selectionMemory_.Store(box, boxMessages_[*restoreIndex].id);
            }

            UpdateStatus(MessagingPresentationModel::BuildLoadStatus(boxMessages_.size()));
            SetScreen(Screen::List);
        });
}

void MessagingFrame::SendComposedMessage()
{
    wxString recipientName = view_->recipientCtrl->GetValue();
    recipientName.Trim(true).Trim(false);
    wxString subject = view_->subjectCtrl->GetValue();
    subject.Trim(true).Trim(false);
    wxString body = view_->bodyCtrl->GetValue();
    body.Trim(true).Trim(false);

    if (recipientName.empty())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::MessagingRecipientRequired), true);
        view_->recipientCtrl->SetFocus();
        return;
    }

    if (body.empty())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::MessagingBodyRequired), true);
        view_->bodyCtrl->SetFocus();
        return;
    }

    auto result = std::make_shared<MessagingMailboxController::SendResult>();
    auto* mailbox = mailboxController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::errors::MessagingSendBusy),
        [mailbox, result, recipientName, subject, body]()
        {
            *result = mailbox->SendToUser(
                lila::shared::text::ToUtf8(recipientName),
                lila::shared::text::ToUtf8(body),
                subject.empty() ? std::optional<std::string>() : std::optional<std::string>(lila::shared::text::ToUtf8(subject)));
            if (!result->recipient.has_value())
            {
                throw std::runtime_error(lila::shared::errors::MessagingRecipientNotFound);
            }
        },
        [this, result]()
        {
            if (!result->recipient.has_value() || !result->message.has_value())
            {
                UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::MessagingSendFailed), true);
                return;
            }

            const wxString userLabel = lila::shared::text::FromUtf8(result->recipient->username);
            const wxString confirmation = wxString::Format(
                lila::shared::text::FromUtf8(lila::shared::errors::MessagingSentToUser),
                userLabel);
            UpdateStatus(confirmation);
            wxMessageBox(
                confirmation,
                lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameHeader),
                wxOK | wxICON_INFORMATION,
                this);
            if (navigationState_.currentBox != domain::MessagingBox::Outbox)
            {
                navigationState_.currentBox = domain::MessagingBox::Outbox;
            }
            CloseCompose();
            LoadBox(navigationState_.currentBox, false);
        });
}

void MessagingFrame::DeleteSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (message.has_value())
    {
        actionController_->Mutate(MessagingActionController::Mutation::Delete, message->id);
    }
}

void MessagingFrame::RestoreSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (message.has_value())
    {
        actionController_->Mutate(MessagingActionController::Mutation::Restore, message->id);
    }
}

void MessagingFrame::PurgeSelectedMessage()
{
    const auto message = GetSelectedMessage();
    if (message.has_value())
    {
        actionController_->Mutate(MessagingActionController::Mutation::Purge, message->id);
    }
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
    view_->subjectCtrl->SetValue(MessagingPresentationModel::BuildReplySubject(*message));
}

void MessagingFrame::MarkSelectedMessageRead()
{
    const auto message = GetSelectedMessage();
    if (!message.has_value() || message->isSent || message->id.empty())
    {
        return;
    }

    actionController_->MarkRead(message->id);
}

std::optional<domain::MessagingMessage> MessagingFrame::GetSelectedMessage() const
{
    const int selection = view_->messagesList->GetSelection();
    if (selection == wxNOT_FOUND || static_cast<std::size_t>(selection) >= boxMessages_.size())
    {
        return std::nullopt;
    }

    return boxMessages_[static_cast<std::size_t>(selection)];
}

void MessagingFrame::SaveCurrentBoxSelection()
{
    const int selected = view_->messagesList->GetSelection();
    if (selected < 0 || static_cast<std::size_t>(selected) >= boxMessages_.size())
    {
        if (boxMessages_.empty())
        {
            selectionMemory_.Clear(navigationState_.currentBox);
        }
        return;
    }

    selectionMemory_.Store(navigationState_.currentBox, boxMessages_[static_cast<std::size_t>(selected)].id);
}

void MessagingFrame::RestoreCurrentBoxSelection()
{
    const auto index = selectionMemory_.ResolveIndex(navigationState_.currentBox, boxMessages_);
    if (index.has_value())
    {
        view_->messagesList->SetSelection(static_cast<int>(*index));
    }
}

}


#include "modules/messaging/presentation/MessagingActionController.inl"
#include "modules/messaging/presentation/MessagingFocusController.inl"
