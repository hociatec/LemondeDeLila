#pragma once

#include <cstddef>
#include <optional>

namespace lila::modules::messaging::domain
{
enum class MessagingBox
{
    Inbox,
    Outbox,
    Deleted,
};

inline constexpr std::size_t MessagingBoxCount = 3;

[[nodiscard]] constexpr std::size_t MessagingBoxIndex(MessagingBox box) noexcept
{
    switch (box)
    {
    case MessagingBox::Inbox:
        return 0;
    case MessagingBox::Outbox:
        return 1;
    case MessagingBox::Deleted:
        return 2;
    }

    return 0;
}

[[nodiscard]] constexpr std::optional<MessagingBox> MessagingBoxFromMenuIndex(std::size_t menuIndex) noexcept
{
    switch (menuIndex)
    {
    case 1:
        return MessagingBox::Inbox;
    case 2:
        return MessagingBox::Outbox;
    case 3:
        return MessagingBox::Deleted;
    default:
        return std::nullopt;
    }
}
}
