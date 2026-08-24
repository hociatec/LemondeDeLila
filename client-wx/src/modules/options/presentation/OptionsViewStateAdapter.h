#pragma once

#include "modules/options/domain/OptionsState.h"

namespace lila::modules::options::presentation
{
class OptionsView;

class OptionsViewStateAdapter final
{
public:
    [[nodiscard]] static domain::OptionsState ReadState(const OptionsView& view, const domain::OptionsState& baseState);
    static void WriteState(OptionsView& view, const domain::OptionsState& state);
    static void UpdateSoundControlInteractivity(OptionsView& view);
};
}
