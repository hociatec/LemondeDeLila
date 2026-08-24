#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/social/presentation/SocialFrame.h"
#include "modules/social/presentation/SocialSectionCoordinator.h"

namespace lila::modules::social::presentation
{
void SocialFrame::OpenProfile(int userId)
{
    sectionCoordinator_->OpenProfile(userId);
}
}
