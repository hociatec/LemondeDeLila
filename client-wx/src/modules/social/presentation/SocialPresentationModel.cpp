#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/social/presentation/SocialPresentationModel.h"

#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/text/presentation/status/CountStatusText.h"
#include "shared/text/presentation/catalog/UiTexts.h"

namespace lila::modules::social::presentation
{
wxString SocialPresentationModel::BuildUserLabel(const domain::SocialUser& user)
{
    if (!user.id.IsValid())
        return lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileUnknownUser);

    const std::string_view userName = user.username.empty()
        ? std::string_view(lila::shared::text::ui::SocialProfileUnknownUser)
        : std::string_view(user.username);
    wxString label = lila::shared::text::FromUtf8(
        userName);
    if (!user.blockedAt.empty() && user.since.empty())
        label += lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileBlockedSuffix);
    return label;
}

wxString SocialPresentationModel::BuildRequestLabel(const domain::SocialFriendRequest& request, bool incoming)
{
    const std::string name = incoming ? request.requester.username : request.addressee.username;
    const std::string_view userName = name.empty()
        ? std::string_view(lila::shared::text::ui::SocialProfileUnknownUser)
        : std::string_view(name);
    wxString label = lila::shared::text::FromUtf8(
        userName);
    if (!request.createdAt.empty())
    {
        label += lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileAt);
        label += lila::shared::text::FromUtf8(request.createdAt);
    }
    return label;
}

std::string SocialPresentationModel::VisibilityToFrench(lila::shared::domain::ProfileVisibility value)
{
    if (value == lila::shared::domain::ProfileVisibility::Friends)
        return std::string(lila::shared::text::ui::SocialProfileVisibilityFriends.str());
    if (value == lila::shared::domain::ProfileVisibility::Private)
        return std::string(lila::shared::text::ui::SocialProfileVisibilityPrivate.str());
    return std::string(lila::shared::text::ui::SocialProfileVisibilityPublic.str());
}

wxString SocialPresentationModel::BuildProfileInfoText(const domain::SocialProfile& profile)
{
    wxString text;
    text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVisibilityPrefix)
         << lila::shared::text::FromUtf8(VisibilityToFrench(profile.visibility)) << '\n';

    if (!profile.createdAt.empty())
        text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileCreatedAt) << lila::shared::text::FromUtf8(profile.createdAt) << '\n';
    if (!profile.updatedAt.empty())
        text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileUpdatedAt) << lila::shared::text::FromUtf8(profile.updatedAt) << '\n';

    if (profile.isOwner || profile.canView)
    {
        const std::string_view bioText = profile.bio.empty()
            ? std::string_view(lila::shared::text::ui::SocialProfileEmptyText)
            : std::string_view(profile.bio);
        const std::string_view victoryText = profile.victoryMessage.empty()
            ? std::string_view(lila::shared::text::ui::SocialProfileEmptyText)
            : std::string_view(profile.victoryMessage);
        const std::string_view defeatText = profile.defeatMessage.empty()
            ? std::string_view(lila::shared::text::ui::SocialProfileEmptyText)
            : std::string_view(profile.defeatMessage);
        text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileBioText)
             << lila::shared::text::FromUtf8(bioText) << "\n\n";
        text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileVictoryText)
             << lila::shared::text::FromUtf8(victoryText) << "\n\n";
        text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileDefeatText)
             << lila::shared::text::FromUtf8(defeatText);
    }
    else
        text << lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfilePrivateText);
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
        return lila::shared::text::FromUtf8(lila::shared::text::ui::SocialProfileLoaded);
    return lila::shared::text::BuildCountStatus(
        count,
        lila::shared::text::ui::SocialSectionResultsEmpty,
        lila::shared::text::ui::SocialSectionResultsCount);
}
}
