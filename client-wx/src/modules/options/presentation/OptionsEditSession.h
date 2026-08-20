#pragma once

#include "modules/options/domain/OptionsState.h"

namespace lila::modules::options::presentation
{
class OptionsEditSession final
{
public:
    void CaptureInitial(const domain::OptionsState& state)
    {
        initialState = state;
    }

    [[nodiscard]] bool HasUnsavedChanges(const domain::OptionsState& current) const noexcept
    {
        return current != initialState;
    }

    domain::OptionsState initialState;
};
}
