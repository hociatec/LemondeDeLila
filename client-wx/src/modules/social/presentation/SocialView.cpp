#include "modules/social/presentation/SocialView.h"

#include "shared/text/Encoding.h"

namespace lila::modules::social::presentation
{
SocialView::SocialView(wxWindow* parent): wxPanel(parent) { BuildLayout(); }

SocialView::ShellControls SocialView::Shell() const noexcept
{
    return {titleLabel, subtitleLabel, statusLabel, menu, sectionBook};
}

SocialView::SectionControls SocialView::FriendsSection() const noexcept
{
    return {friendsList, emptyFriendsCtrl, friendsActionsMenu};
}

SocialView::SectionControls SocialView::IncomingSection() const noexcept
{
    return {incomingRequestsList, emptyIncomingRequestsCtrl, incomingActionsMenu};
}

SocialView::SectionControls SocialView::OutgoingSection() const noexcept
{
    return {outgoingRequestsList, emptyOutgoingRequestsCtrl, outgoingActionsMenu};
}

SocialView::SectionControls SocialView::BlockedSection() const noexcept
{
    return {blockedUsersList, emptyBlockedUsersCtrl, blockedActionsMenu};
}

SocialView::ProfileControls SocialView::Profile() const noexcept
{
    return {
        profileTitleLabel,
        profileInfoCtrl,
        profileMenu,
        profileBioCtrl,
        profileVictoryCtrl,
        profileDefeatCtrl,
        profileVisibilityChoice,
        profileSaveButton,
        profileCancelButton};
}
}
