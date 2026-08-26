#include "modules/leaderboard/presentation/LeaderboardPanel.h"

#include "shared/ui/presentation/layout/ListPageLayout.h"

namespace lila::modules::leaderboard::presentation
{
void LeaderboardPanel::BuildLayout()
{
    const auto controls = lila::shared::ui::layout::BuildListPageLayout(
        *this,
        {wxString(L"Classement"), 420, wxSize(960, 700), true});
    menu_ = controls.menu;
    titleLabel_ = controls.title;
    statusLabel_ = controls.status;
}
}
