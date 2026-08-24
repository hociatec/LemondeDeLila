#pragma once

#include <string>

namespace lila::modules::storybook::domain
{
struct StoryBookCounts final
{
    int finished = 0;
    int quit = 0;
    int won = 0;
    int lost = 0;
};

struct StoryBookGame final
{
    std::string gameType;
    std::string gameName;
    StoryBookCounts withBots;
    StoryBookCounts withoutBots;
};
}
