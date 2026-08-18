#pragma once

#include <array>
#include <cstddef>
#include <optional>
#include <span>
#include <string>

#include "modules/messaging/domain/MessagingBox.h"
#include "modules/messaging/domain/MessagingMessage.h"

namespace lila::modules::messaging::presentation
{
class MessagingSelectionMemory final
{
public:
    void Store(domain::MessagingBox box, std::optional<std::string> messageId);
    void Clear(domain::MessagingBox box);
    [[nodiscard]] const std::optional<std::string>& Get(domain::MessagingBox box) const;
    [[nodiscard]] std::optional<std::size_t> ResolveIndex(
        domain::MessagingBox box,
        std::span<const domain::MessagingMessage> messages) const;

private:
    std::array<std::optional<std::string>, domain::MessagingBoxCount> selectedIds_{};
};
}
