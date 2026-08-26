#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/messaging/presentation/MessagingPresentationModel.h"

#include <ctime>
#include <cstddef>

#include <wx/datetime.h>

#include "shared/text/presentation/status/CountStatusText.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::messaging::presentation
{
wxString MessagingPresentationModel::BoxTitle(domain::MessagingBox box)
{
    switch (box)
    {
    case domain::MessagingBox::Inbox:
        return lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuInbox);
    case domain::MessagingBox::Outbox:
        return lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuOutbox);
    case domain::MessagingBox::Deleted:
        return lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingMenuDeleted);
    }

    return lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingFrameHeader);
}

wxString MessagingPresentationModel::BuildMessageLabel(const domain::MessagingMessage& message)
{
    const wxDateTime timestamp(static_cast<time_t>(message.createdAtUtc));
    const wxString timeLabel = timestamp.IsValid()
        ? timestamp.Format("%d/%m %H:%M")
        : lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingUnknownUser);
    const wxString userLabel = lila::shared::text::FromUtf8(
        message.isSent ? message.recipient.username : message.sender.username);
    const std::string_view subjectText = message.subject.empty()
        ? std::string_view(lila::shared::text::ui::MessagingNoSubject)
        : std::string_view(message.subject);
    const wxString subject = lila::shared::text::FromUtf8(
        subjectText);
    return timeLabel
        + lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingSubjectSeparator)
        + userLabel
        + lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingSubjectSeparator)
        + subject;
}

wxString MessagingPresentationModel::BuildMessageDetail(const domain::MessagingMessage& message)
{
    const wxDateTime timestamp(static_cast<time_t>(message.createdAtUtc));
    wxString text;
    const std::string_view subjectText = message.subject.empty()
        ? std::string_view(lila::shared::text::ui::MessagingNoSubject)
        : std::string_view(message.subject);
    text << lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLabelSubject)
         << lila::shared::text::FromUtf8(subjectText)
         << lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLabelFrom)
         << lila::shared::text::FromUtf8(message.sender.username)
         << lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLabelTo)
         << lila::shared::text::FromUtf8(message.recipient.username)
         << lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLabelDate)
         << (timestamp.IsValid()
                 ? timestamp.Format("%d/%m/%Y %H:%M")
                 : lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingUnknownUser))
         << lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingLabelContent)
         << lila::shared::text::FromUtf8(message.text);
    return text;
}

wxString MessagingPresentationModel::BuildReplySubject(const domain::MessagingMessage& message)
{
    const wxString subject = lila::shared::text::FromUtf8(message.subject);
    const wxString prefix = lila::shared::text::FromUtf8(lila::shared::text::ui::MessagingReplyPrefix);
    return subject.StartsWith(prefix) ? subject : prefix + subject;
}

wxString MessagingPresentationModel::BuildLoadStatus(std::size_t count)
{
    return lila::shared::text::BuildCountStatus(
        count,
        lila::shared::text::ui::MessagingLoadResultsEmpty,
        lila::shared::text::ui::MessagingLoadResultsCount);
}
}
