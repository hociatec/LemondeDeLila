#include "modules/vault/presentation/VaultPanel.h"

#include "shared/ui/presentation/layout/ListPageLayout.h"

namespace lila::modules::vault::presentation
{
void VaultPanel::BuildLayout()
{
    const auto controls = lila::shared::ui::layout::BuildListPageLayout(
        *this,
        {wxString{}, 520, wxDefaultSize, false});
    menu_ = controls.menu;
    statusLabel_ = controls.status;
}
}
