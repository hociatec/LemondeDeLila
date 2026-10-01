#pragma once

namespace lila::modules::gameplay::application
{
// Single source of truth for the stable Room entry and any concrete gameplay
// control proposed as its activation target. It deliberately has no wxWidgets
// dependency so every visibility/focus combination is unit-testable.
class GamePlayAccessPolicy final
{
public:
    [[nodiscard]] static constexpr bool KeepStableEntryVisible() noexcept
    {
        return true;
    }

    [[nodiscard]] static constexpr bool IsUsableTarget(
        bool shownOnScreen, bool enabled, bool acceptsFocus) noexcept
    {
        return shownOnScreen && enabled && acceptsFocus;
    }

    [[nodiscard]] static constexpr bool ShouldReplaceContentWithOverlay(
        bool overlayActive, bool overlayHasUsableTarget) noexcept
    {
        return overlayActive && overlayHasUsableTarget;
    }
};
}
