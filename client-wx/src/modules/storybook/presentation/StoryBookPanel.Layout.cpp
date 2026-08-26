#include "modules/storybook/presentation/StoryBookPanel.h"

#include "shared/ui/presentation/layout/ListPageLayout.h"

namespace lila::modules::storybook::presentation
{
void StoryBookPanel::BuildLayout()
{
    const auto controls = lila::shared::ui::layout::BuildListPageLayout(
        *this,
        {wxString(L"Livre des contes"), 420, wxSize(960, 700), true});
    menu_ = controls.menu;
    titleLabel_ = controls.title;
    statusLabel_ = controls.status;
}
}
