#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingFrame.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "modules/messaging/presentation/MessagingActionController.h"
#include "modules/messaging/presentation/MessagingComposeController.h"
#include "modules/messaging/presentation/MessagingFocusController.h"
#include "modules/messaging/presentation/MessagingView.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"
#include "modules/messaging/presentation/MessagingScreenCoordinator.h"

#include <wx/msgdlg.h>
#include <wx/textctrl.h>

#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::messaging::presentation
{
void MessagingFrame::SendComposedMessage()
{
    const auto compose = view_->Compose();
    wxString recipientName = compose.recipientCtrl->GetValue();
    recipientName.Trim(true).Trim(false);
    wxString subject = compose.subjectCtrl->GetValue();
    subject.Trim(true).Trim(false);
    wxString body = compose.bodyCtrl->GetValue();
    body.Trim(true).Trim(false);

    if (recipientName.empty())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingRecipientRequired), true);
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposeRecipientPlan()));
        return;
    }

    if (body.empty())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingBodyRequired), true);
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposeBodyPlan()));
        return;
    }
    composeController_->Send(MessagingComposeController::SendPayload{
        lila::shared::text::ToUtf8(recipientName),
        subject.empty() ? std::optional<std::string>() : std::optional<std::string>(lila::shared::text::ToUtf8(subject)),
        lila::shared::text::ToUtf8(body)});
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

    const domain::MessagingUser recipient = MessagingComposeController::ResolveReplyRecipient(*message);
    OpenCompose(recipient, Screen::Detail);
    view_->Compose().subjectCtrl->SetValue(MessagingPresentationModel::BuildReplySubject(*message));
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
