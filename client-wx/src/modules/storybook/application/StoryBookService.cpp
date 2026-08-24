#include "modules/storybook/application/StoryBookService.h"

#include <stdexcept>

#include "modules/storybook/application/IStoryBookGateway.h"

namespace lila::modules::storybook::application
{
StoryBookService::StoryBookService(IStoryBookGateway& gateway) noexcept : gateway_(gateway) {}

std::vector<domain::StoryBookGame> StoryBookService::LoadOwn(std::stop_token stopToken) const
{
    return gateway_.LoadOwn(stopToken);
}

std::vector<domain::StoryBookGame> StoryBookService::LoadUser(int userId, std::stop_token stopToken) const
{
    if (userId <= 0)
    {
        throw std::invalid_argument("Story book user id must be positive.");
    }
    return gateway_.LoadUser(userId, stopToken);
}
}
