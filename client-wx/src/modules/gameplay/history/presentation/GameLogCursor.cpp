#include "modules/gameplay/history/presentation/GameLogCursor.h"

namespace lila::modules::gameplay::presentation::history
{
namespace
{
std::string Identity(const std::string& message)
{
    const auto separator = message.find('|');
    return separator == std::string::npos ? message : message.substr(0, separator);
}
}

std::vector<std::string> GameLogCursor::ExtractNew(
    const std::vector<std::string>& messages)
{
    std::vector<std::string> fresh;
    fresh.reserve(messages.size());
    for (const auto& message : messages)
    {
        if (message.empty()) continue;
        const auto identity = Identity(message);
        if (!identity.empty() && publishedIdentities_.insert(identity).second)
            fresh.push_back(message);
    }
    return fresh;
}

void GameLogCursor::Reset() noexcept
{
    publishedIdentities_.clear();
}

void GameLogCursor::Restore(const std::vector<std::string>& messages)
{
    for (const auto& message : messages)
    {
        const auto identity = Identity(message);
        if (!identity.empty()) publishedIdentities_.insert(identity);
    }
}
}
