#pragma once

#include <functional>

#include "modules/social/presentation/SocialNavigationState.h"

class wxWindow;

namespace lila::modules::social::presentation
{
class SocialDataStore;
class SocialView;

// Owns the wxWidgets focus policy for the Social screen. SocialFrame remains
// responsible for application actions while this class centralizes keyboard
// focus, cyclic Tab navigation and section focus targets.
class SocialFocusController final
{
public:
    using SelectionSyncHandler = std::function<void()>;

    SocialFocusController(
        SocialView& view,
        SocialNavigationState& navigationState,
        SelectionSyncHandler onSelectionAdjusted);

    void BindNavigation(wxWindow& owner);
    void FocusCurrentScreen();
    void FocusCurrentSectionActionMenu();

    [[nodiscard]] wxWindow* CurrentSectionActionControl() const;
    [[nodiscard]] wxWindow* CurrentSectionList() const;

private:
    SocialView& view_;
    SocialNavigationState& navigationState_;
    SelectionSyncHandler onSelectionAdjusted_;
};
}
