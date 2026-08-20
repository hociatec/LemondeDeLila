#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "modules/messaging/presentation/MessagingActionController.h"
#include "modules/messaging/presentation/MessagingMailboxController.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <memory>

#include <wx/msgdlg.h>
#include <wx/textctrl.h>

#include "shared/errors/ErrorMessages.h"
#include "shared/text/UiTexts.h"

namespace lila::modules::messaging::presentation
{
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
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingRecipientRequired), true);
        view_->recipientCtrl->SetFocus();
        return;
    }

    if (body.empty())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingBodyRequired), true);
        view_->bodyCtrl->SetFocus();
        return;
    }

    auto result = std::make_shared<MessagingMailboxController::SendResult>();
    auto* mailbox = mailboxController_.get();
    RunBackgroundTask(
        lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingSendBusy),
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
                lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingSentToUser),
                userLabel);
            UpdateStatus(confirmation);
            wxMessageBox(
                confirmation,
                lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameHeader),
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
}
