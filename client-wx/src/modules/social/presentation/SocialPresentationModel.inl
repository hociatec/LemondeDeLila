#include "shared/text/Encoding.h"
#include "modules/social/presentation/SocialPresentationModel.h"

#include "shared/contracts/BackendWsContracts.h"
#include "shared/errors/ErrorMessages.h"

namespace lila::modules::social::presentation
{
wxString SocialPresentationModel::BuildUserLabel(const domain::SocialUser& user)
{
    if (user.id <= 0)
        return lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileUnknownUser);

    wxString label = lila::shared::text::FromUtf8(
        user.username.empty() ? lila::shared::errors::SocialProfileUnknownUser : user.username);
    if (!user.blockedAt.empty() && user.since.empty())
        label += lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileBlockedSuffix);
    return label;
}

wxString SocialPresentationModel::BuildRequestLabel(const domain::SocialFriendRequest& request, bool incoming)
{
    const std::string name = incoming ? request.requester.username : request.addressee.username;
    wxString label = lila::shared::text::FromUtf8(
        name.empty() ? lila::shared::errors::SocialProfileUnknownUser : name);
    if (!request.createdAt.empty())
    {
        label += lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileAt);
        label += lila::shared::text::FromUtf8(request.createdAt);
    }
    return label;
}

std::string SocialPresentationModel::VisibilityToFrench(const std::string& value)
{
    if (value == lila::shared::contracts::social::SocialVisibilityFriends)
        return lila::shared::errors::SocialProfileVisibilityFriends;
    if (value == lila::shared::contracts::social::SocialVisibilityPrivate)
        return lila::shared::errors::SocialProfileVisibilityPrivate;
    return lila::shared::errors::SocialProfileVisibilityPublic;
}

wxString SocialPresentationModel::BuildProfileInfoText(const domain::SocialProfile& profile)
{
    wxString text;
    text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVisibilityPrefix)
         << lila::shared::text::FromUtf8(VisibilityToFrench(profile.visibility)) << '\n';

    if (!profile.createdAt.empty())
        text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileCreatedAt) << lila::shared::text::FromUtf8(profile.createdAt) << '\n';
    if (!profile.updatedAt.empty())
        text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileUpdatedAt) << lila::shared::text::FromUtf8(profile.updatedAt) << '\n';

    if (profile.isOwner || profile.canView)
    {
        text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileBioText)
             << lila::shared::text::FromUtf8(profile.bio.empty() ? lila::shared::errors::SocialProfileEmptyText : profile.bio) << "\n\n";
        text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileVictoryText)
             << lila::shared::text::FromUtf8(profile.victoryMessage.empty() ? lila::shared::errors::SocialProfileEmptyText : profile.victoryMessage) << "\n\n";
        text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileDefeatText)
             << lila::shared::text::FromUtf8(profile.defeatMessage.empty() ? lila::shared::errors::SocialProfileEmptyText : profile.defeatMessage);
    }
    else
        text << lila::shared::text::FromUtf8(lila::shared::errors::SocialProfilePrivateText);
    return text;
}

std::optional<SocialSection> SocialPresentationModel::MenuIndexToSection(std::size_t index)
{
    switch (index)
    {
    case 1: return SocialSection::Friends;
    case 2: return SocialSection::IncomingRequests;
    case 3: return SocialSection::OutgoingRequests;
    case 4: return SocialSection::Blocked;
    case 5: return SocialSection::Profile;
    default: return std::nullopt;
    }
}

std::size_t SocialPresentationModel::SectionToMenuIndex(SocialSection section)
{
    switch (section)
    {
    case SocialSection::Friends: return 1;
    case SocialSection::IncomingRequests: return 2;
    case SocialSection::OutgoingRequests: return 3;
    case SocialSection::Blocked: return 4;
    case SocialSection::Profile: return 5;
    }
    return 1;
}

wxString SocialPresentationModel::BuildSectionStatus(SocialSection section, std::size_t count)
{
    if (section == SocialSection::Profile)
        return lila::shared::text::FromUtf8(lila::shared::errors::SocialProfileLoaded);
    return count == 0
        ? lila::shared::text::FromUtf8(lila::shared::errors::SocialSectionResultsEmpty)
        : wxString::Format(lila::shared::text::FromUtf8(lila::shared::errors::SocialSectionResultsCount), count);
}
}
