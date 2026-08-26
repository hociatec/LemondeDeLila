#include "modules/rooms/presentation/join/JoinRoomsPanel.h"

#include "shared/ui/presentation/layout/ListPageLayout.h"

namespace lila::modules::rooms::presentation
{
void JoinRoomsPanel::BuildLayout()
{
    const auto controls = lila::shared::ui::layout::BuildListPageLayout(
        *this,
        {wxString{}, 520, wxDefaultSize, false});
    menu_ = controls.menu;
    statusLabel_ = controls.status;
}
}
