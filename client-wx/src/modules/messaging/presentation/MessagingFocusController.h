#pragma once

#include <functional>

#include "modules/messaging/presentation/MessagingNavigationState.h"

class wxWindow;

namespace lila::modules::messaging::presentation
{
class MessagingView;

class MessagingFocusController final
{
public:
    using SelectionSyncHandler = std::function<void()>;

    MessagingFocusController(
        MessagingView& view,
        MessagingNavigationState& navigationState,
        SelectionSyncHandler onSelectionAdjusted);

    void BindNavigation(wxWindow& owner);
    void FocusCurrentScreen();

private:
    MessagingView& view_;
    MessagingNavigationState& navigationState_;
    SelectionSyncHandler onSelectionAdjusted_;
};
}
