#pragma once

#include "shared/accessibility/FocusManager.h"

namespace lila::shared::accessibility
{
class FocusPlanView
{
public:
    virtual ~FocusPlanView() = default;

    [[nodiscard]] virtual FocusManager::Plan BuildFocusPlan() = 0;
};
}
