#pragma once

#include <string>
#include <unordered_set>
#include <vector>

namespace lila::modules::gameplay::presentation::history
{
class GameLogCursor final
{
public:
    [[nodiscard]] std::vector<std::string> ExtractNew(
        const std::vector<std::string>& messages);
    [[nodiscard]] bool RestoreInitialBaseline(
        const std::vector<std::string>& messages, int stateVersion);
    void Restore(const std::vector<std::string>& messages);
    void Reset() noexcept;

private:
    std::unordered_set<std::string> publishedIdentities_;
};
}
