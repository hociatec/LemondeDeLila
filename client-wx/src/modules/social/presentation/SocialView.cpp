#include "modules/social/presentation/SocialView.h"

#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::social::presentation
{
SocialView::SocialView(wxWindow* parent): wxPanel(parent) { BuildLayout(); }

SocialView::ShellControls SocialView::Shell() const noexcept
{
    return {titleLabel, subtitleLabel, statusLabel, menu, sectionBook};
}

SocialView::SectionControls SocialView::FriendsSection() const noexcept
{
    return {friendsPanel, friendsList, emptyFriendsCtrl, friendsActionsMenu};
}

SocialView::SectionControls SocialView::IncomingSection() const noexcept
{
    return {incomingRequestsPanel, incomingRequestsList, emptyIncomingRequestsCtrl, incomingActionsMenu};
}

SocialView::SectionControls SocialView::OutgoingSection() const noexcept
{
    return {outgoingRequestsPanel, outgoingRequestsList, emptyOutgoingRequestsCtrl, outgoingActionsMenu};
}

SocialView::SectionControls SocialView::BlockedSection() const noexcept
{
    return {blockedPanel, blockedUsersList, emptyBlockedUsersCtrl, blockedActionsMenu};
}

SocialView::SectionControls SocialView::SectionFor(SocialSection section) const noexcept
{
    switch (section)
    {
    case SocialSection::Friends:
        return FriendsSection();
    case SocialSection::IncomingRequests:
        return IncomingSection();
    case SocialSection::OutgoingRequests:
        return OutgoingSection();
    case SocialSection::Blocked:
        return BlockedSection();
    case SocialSection::Profile:
        return {profilePanel, nullptr, nullptr, nullptr};
    }

    return {nullptr, nullptr, nullptr, nullptr};
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
