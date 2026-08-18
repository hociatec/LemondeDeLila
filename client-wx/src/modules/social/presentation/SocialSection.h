#pragma once

#include <cstddef>

namespace lila::modules::social::presentation
{
enum class SocialSection
{
    Friends,
    IncomingRequests,
    OutgoingRequests,
    Blocked,
    Profile,
};

[[nodiscard]] constexpr std::size_t SocialSectionIndex(SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends:
        return 0;
    case SocialSection::IncomingRequests:
        return 1;
    case SocialSection::OutgoingRequests:
        return 2;
    case SocialSection::Blocked:
        return 3;
    case SocialSection::Profile:
        return 4;
    }

    return 0;
}
}
