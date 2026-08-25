#pragma once

#include <string>
#include <vector>

namespace lila::modules::gameplay::presentation::history
{
class GameLogCursor final
{
public:
    [[nodiscard]] std::vector<std::string> ExtractNew(
        const std::vector<std::string>& messages);
    void Reset() noexcept;

private:
    std::vector<std::string> publishedMessages_;
};
}
