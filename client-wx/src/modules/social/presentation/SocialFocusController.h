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
        wxWindow& owner,
        SocialView& view,
        SocialNavigationState& navigationState,
        const SocialDataStore& dataStore,
        SelectionSyncHandler onSelectionAdjusted);

    void BindNavigation(wxWindow& owner);
    void FocusCurrentScreen();
    void FocusCurrentSectionActionMenu();

    [[nodiscard]] wxWindow* CurrentSectionActionControl() const;
    [[nodiscard]] wxWindow* CurrentSectionList() const;

private:
    wxWindow& owner_;
    SocialView& view_;
    SocialNavigationState& navigationState_;
    const SocialDataStore& dataStore_;
    SelectionSyncHandler onSelectionAdjusted_;
};
}
