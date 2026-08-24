#pragma once

#include <stop_token>
#include <vector>

#include "modules/storybook/domain/StoryBookStats.h"

namespace lila::modules::storybook::application
{
class IStoryBookGateway
{
public:
    virtual ~IStoryBookGateway() = default;
    [[nodiscard]] virtual std::vector<domain::StoryBookGame> LoadOwn(std::stop_token stopToken) const = 0;
    [[nodiscard]] virtual std::vector<domain::StoryBookGame> LoadUser(int userId, std::stop_token stopToken) const = 0;
};
}
