#pragma once

#include <ctime>

#include "modules/chat/domain/ChatMessage.h"

namespace lila::modules::chat::presentation
{
class ChatMessageActions final
{
public:
    [[nodiscard]] static bool CanActOnMessage(
        const domain::ChatMessage& message,
        int editWindowSeconds,
        std::time_t nowUtc) noexcept
    {
        if (!message.isMine || message.id.empty())
        {
            return false;
        }

        if (editWindowSeconds <= 0)
        {
            return false;
        }

        const auto age = static_cast<long long>(nowUtc - message.timestampUtc);
        return age >= 0 && age <= editWindowSeconds;
    }

private:
    ChatMessageActions() = default;
};
}
