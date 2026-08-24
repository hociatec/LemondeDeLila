#pragma once

#include <optional>
#include <string_view>

namespace lila::modules::social::presentation
{
enum class SocialActionId
{
    ViewProfile,
    RemoveFriend,
    ToggleBlock,
    AcceptRequest,
    RejectRequest,
    CancelRequest,
    UnblockUser,
    EditBio,
    EditVictoryMessage,
    EditDefeatMessage,
    EditVisibility,
    OpenStoryBook,
};

[[nodiscard]] inline std::optional<SocialActionId> ParseSocialActionId(std::string_view id) noexcept
{
    if (id == "view-profile")
    {
        return SocialActionId::ViewProfile;
    }
    if (id == "remove-friend")
    {
        return SocialActionId::RemoveFriend;
    }
    if (id == "block-friend" || id == "block-user")
    {
        return SocialActionId::ToggleBlock;
    }
    if (id == "accept-request")
    {
        return SocialActionId::AcceptRequest;
    }
    if (id == "reject-request")
    {
        return SocialActionId::RejectRequest;
    }
    if (id == "cancel-request")
    {
        return SocialActionId::CancelRequest;
    }
    if (id == "unblock-user")
    {
        return SocialActionId::UnblockUser;
    }
    if (id == "bio")
    {
        return SocialActionId::EditBio;
    }
    if (id == "victory")
    {
        return SocialActionId::EditVictoryMessage;
    }
    if (id == "defeat")
    {
        return SocialActionId::EditDefeatMessage;
    }
    if (id == "visibility")
    {
        return SocialActionId::EditVisibility;
    }
    if (id == "storybook")
    {
        return SocialActionId::OpenStoryBook;
    }

    return std::nullopt;
}
}
