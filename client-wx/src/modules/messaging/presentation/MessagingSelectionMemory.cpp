#include "modules/messaging/presentation/MessagingSelectionMemory.h"

namespace lila::modules::messaging::presentation
{
void MessagingSelectionMemory::Store(
    domain::MessagingBox box,
    std::optional<lila::shared::domain::MessageId> messageId)
{
    selectedIds_[domain::MessagingBoxIndex(box)] = std::move(messageId);
}

void MessagingSelectionMemory::Clear(domain::MessagingBox box)
{
    selectedIds_[domain::MessagingBoxIndex(box)].reset();
}

const std::optional<lila::shared::domain::MessageId>& MessagingSelectionMemory::Get(domain::MessagingBox box) const
{
    return selectedIds_[domain::MessagingBoxIndex(box)];
}

std::optional<std::size_t> MessagingSelectionMemory::ResolveIndex(
    domain::MessagingBox box,
    std::span<const domain::MessagingMessage> messages) const
{
    const auto& selectedId = Get(box);
    if (selectedId.has_value())
    {
        for (std::size_t index = 0; index < messages.size(); ++index)
        {
            if (messages[index].id == *selectedId)
            {
                return index;
            }
        }
    }

    return messages.empty() ? std::nullopt : std::optional<std::size_t>{0};
}
}
