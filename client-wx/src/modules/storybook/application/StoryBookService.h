#pragma once

#include <stop_token>
#include <vector>

#include "modules/storybook/domain/StoryBookStats.h"

namespace lila::modules::storybook::application
{
class IStoryBookGateway;

class StoryBookService final
{
public:
    explicit StoryBookService(IStoryBookGateway& gateway) noexcept;
    [[nodiscard]] std::vector<domain::StoryBookGame> LoadOwn(std::stop_token stopToken) const;
    [[nodiscard]] std::vector<domain::StoryBookGame> LoadUser(int userId, std::stop_token stopToken) const;

private:
    IStoryBookGateway& gateway_;
};
}
