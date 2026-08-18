#pragma once

#include <cstddef>
#include <wx/string.h>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"

namespace lila::modules::messaging::presentation
{
class MessagingPresentationModel final
{
public:
    [[nodiscard]] static wxString BoxTitle(domain::MessagingBox box);
    [[nodiscard]] static wxString BuildMessageLabel(const domain::MessagingMessage& message);
    [[nodiscard]] static wxString BuildMessageDetail(const domain::MessagingMessage& message);
    [[nodiscard]] static wxString BuildReplySubject(const domain::MessagingMessage& message);
    [[nodiscard]] static wxString BuildLoadStatus(std::size_t count);
};
}
