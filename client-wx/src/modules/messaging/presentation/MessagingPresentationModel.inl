#include "shared/text/Encoding.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <ctime>
#include <cstddef>

#include <wx/datetime.h>

#include "shared/errors/ErrorMessages.h"

namespace lila::modules::messaging::presentation
{
wxString MessagingPresentationModel::BoxTitle(domain::MessagingBox box)
{
    switch (box)
    {
    case domain::MessagingBox::Inbox:
        return lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuInbox);
    case domain::MessagingBox::Outbox:
        return lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuOutbox);
    case domain::MessagingBox::Deleted:
        return lila::shared::text::FromUtf8(lila::shared::errors::MessagingMenuDeleted);
    }

    return lila::shared::text::FromUtf8(lila::shared::errors::MessagingFrameHeader);
}

wxString MessagingPresentationModel::BuildMessageLabel(const domain::MessagingMessage& message)
{
    const wxDateTime timestamp(static_cast<time_t>(message.createdAtUtc));
    const wxString timeLabel = timestamp.IsValid()
        ? timestamp.Format("%d/%m %H:%M")
        : lila::shared::text::FromUtf8(lila::shared::errors::MessagingUnknownUser);
    const wxString userLabel = lila::shared::text::FromUtf8(
        message.isSent ? message.recipient.username : message.sender.username);
    const wxString subject = lila::shared::text::FromUtf8(
        message.subject.empty() ? lila::shared::errors::MessagingNoSubject : message.subject);
    return timeLabel
        + lila::shared::text::FromUtf8(lila::shared::errors::MessagingSubjectSeparator)
        + userLabel
        + lila::shared::text::FromUtf8(lila::shared::errors::MessagingSubjectSeparator)
        + subject;
}

wxString MessagingPresentationModel::BuildMessageDetail(const domain::MessagingMessage& message)
{
    const wxDateTime timestamp(static_cast<time_t>(message.createdAtUtc));
    wxString text;
    text << lila::shared::text::FromUtf8(lila::shared::errors::MessagingLabelSubject)
         << lila::shared::text::FromUtf8(message.subject.empty() ? lila::shared::errors::MessagingNoSubject : message.subject)
         << lila::shared::text::FromUtf8(lila::shared::errors::MessagingLabelFrom)
         << lila::shared::text::FromUtf8(message.sender.username)
         << lila::shared::text::FromUtf8(lila::shared::errors::MessagingLabelTo)
         << lila::shared::text::FromUtf8(message.recipient.username)
         << lila::shared::text::FromUtf8(lila::shared::errors::MessagingLabelDate)
         << (timestamp.IsValid()
                 ? timestamp.Format("%d/%m/%Y %H:%M")
                 : lila::shared::text::FromUtf8(lila::shared::errors::MessagingUnknownUser))
         << lila::shared::text::FromUtf8(lila::shared::errors::MessagingLabelContent)
         << lila::shared::text::FromUtf8(message.text);
    return text;
}

wxString MessagingPresentationModel::BuildReplySubject(const domain::MessagingMessage& message)
{
    const wxString subject = lila::shared::text::FromUtf8(message.subject);
    const wxString prefix = lila::shared::text::FromUtf8(lila::shared::errors::MessagingReplyPrefix);
    return subject.StartsWith(prefix) ? subject : prefix + subject;
}

wxString MessagingPresentationModel::BuildLoadStatus(std::size_t count)
{
    return count == 0
        ? lila::shared::text::FromUtf8(lila::shared::errors::MessagingLoadResultsEmpty)
        : wxString::Format(lila::shared::text::FromUtf8(lila::shared::errors::MessagingLoadResultsCount), count);
}
}
