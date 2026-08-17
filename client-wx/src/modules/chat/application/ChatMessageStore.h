#pragma once

#include <mutex>
#include <vector>

#include "modules/chat/domain/ChatMessage.h"

namespace lila::modules::chat::application
{
class ChatMessageStore final
{
public:
    using Messages = std::vector<domain::ChatMessage>;

    void Clear();

    void LoadHistory(Messages messages, int editWindowSeconds);
    void UpsertMessage(domain::ChatMessage message);
    void RemoveMessageById(const std::string& messageId);

    [[nodiscard]] Messages Snapshot() const;
    void SetEditWindowSeconds(int editWindowSeconds);
    [[nodiscard]] int EditWindowSeconds() const;

private:
    void TrimToMaximum();

    mutable std::mutex mutex_;
    Messages messages_;
    int editWindowSeconds_ = 300;
};
}
