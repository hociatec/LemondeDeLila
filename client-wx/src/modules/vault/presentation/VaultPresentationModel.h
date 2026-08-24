#pragma once

#include <vector>

#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::vault::presentation
{
class VaultNavigator;

class VaultPresentationModel final
{
public:
    [[nodiscard]] static std::vector<lila::shared::ui::controls::VerticalMenuItem> BuildItems(
        const VaultNavigator& navigator,
        bool showRetry);
};
}
