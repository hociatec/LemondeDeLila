#pragma once

#include <cstddef>
#include <optional>
#include <string>

#include <wx/string.h>

#include "modules/social/domain/SocialFriendRequest.h"
#include "modules/social/domain/SocialProfile.h"
#include "modules/social/domain/SocialUser.h"
#include "modules/social/presentation/SocialSection.h"

namespace lila::modules::social::presentation
{
class SocialPresentationModel final
{
public:
    [[nodiscard]] static wxString BuildUserLabel(const domain::SocialUser& user);
    [[nodiscard]] static wxString BuildRequestLabel(const domain::SocialFriendRequest& request, bool incoming);
    [[nodiscard]] static wxString BuildProfileInfoText(const domain::SocialProfile& profile);
    [[nodiscard]] static std::string VisibilityToFrench(lila::shared::domain::ProfileVisibility value);
    [[nodiscard]] static std::optional<SocialSection> MenuIndexToSection(std::size_t index);
    [[nodiscard]] static std::size_t SectionToMenuIndex(SocialSection section);
    [[nodiscard]] static wxString BuildSectionStatus(SocialSection section, std::size_t count);
};
}
