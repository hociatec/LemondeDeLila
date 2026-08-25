#include "modules/gameplay/presentation/history/GameLogCursor.h"

#include <algorithm>
#include <cstddef>

namespace lila::modules::gameplay::presentation::history
{
std::vector<std::string> GameLogCursor::ExtractNew(
    const std::vector<std::string>& messages)
{
    // Some transient states omit the log. Keeping the cursor prevents the
    // complete history from being replayed when the log returns.
    if (messages.empty()) return {};

    std::size_t overlap = std::min(publishedMessages_.size(), messages.size());
    while (overlap > 0 && !std::equal(
        publishedMessages_.end() - static_cast<std::ptrdiff_t>(overlap),
        publishedMessages_.end(),
        messages.begin()))
    {
        --overlap;
    }

    std::vector<std::string> fresh;
    fresh.reserve(messages.size() - overlap);
    for (std::size_t index = overlap; index < messages.size(); ++index)
        if (!messages[index].empty()) fresh.push_back(messages[index]);
    publishedMessages_ = messages;
    return fresh;
}

void GameLogCursor::Reset() noexcept
{
    publishedMessages_.clear();
}
}
