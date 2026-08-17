#include "modules/chat/application/ChatMessageStore.h"

#include <algorithm>

namespace lila::modules::chat::application
{
void ChatMessageStore::Clear()
{
    std::scoped_lock lock(mutex_);
    messages_.clear();
}

void ChatMessageStore::LoadHistory(Messages messages, int editWindowSeconds)
{
    {
        std::scoped_lock lock(mutex_);
        messages_ = std::move(messages);
        SetEditWindowSeconds(editWindowSeconds);
        TrimToMaximum();
    }
}

void ChatMessageStore::UpsertMessage(domain::ChatMessage message)
{
    if (message.text.empty())
    {
        return;
    }

    std::scoped_lock lock(mutex_);
    const auto iterator = std::find_if(
        messages_.begin(),
        messages_.end(),
        [&message](const domain::ChatMessage& existing)
        {
            return !message.id.empty() && existing.id == message.id;
        });

    if (iterator == messages_.end())
    {
        messages_.push_back(std::move(message));
    }
    else
    {
        *iterator = std::move(message);
    }

    TrimToMaximum();
}

void ChatMessageStore::RemoveMessageById(const std::string& messageId)
{
    if (messageId.empty())
    {
        return;
    }

    std::scoped_lock lock(mutex_);
    messages_.erase(
        std::remove_if(
            messages_.begin(),
            messages_.end(),
            [&messageId](const domain::ChatMessage& message)
            {
                return message.id == messageId;
            }),
        messages_.end());
}

ChatMessageStore::Messages ChatMessageStore::Snapshot() const
{
    std::scoped_lock lock(mutex_);
    return messages_;
}

void ChatMessageStore::SetEditWindowSeconds(int editWindowSeconds)
{
    editWindowSeconds_ = editWindowSeconds < 0 ? 0 : editWindowSeconds;
}

int ChatMessageStore::EditWindowSeconds() const
{
    std::scoped_lock lock(mutex_);
    return editWindowSeconds_;
}

void ChatMessageStore::TrimToMaximum()
{
    if (messages_.size() > lila::shared::contracts::chat::MaxHistoryMessages)
    {
        messages_.erase(
            messages_.begin(),
            messages_.begin() +
                static_cast<std::ptrdiff_t>(
                    messages_.size() - lila::shared::contracts::chat::MaxHistoryMessages));
    }
}
}
