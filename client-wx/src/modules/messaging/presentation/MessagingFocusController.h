#pragma once

#include <functional>

#include "shared/accessibility/FocusManager.h"

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
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildCurrentScreenPlan();
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildComposeRecipientPlan() const;
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildComposeBodyPlan() const;

private:
    MessagingView& view_;
    MessagingNavigationState& navigationState_;
    SelectionSyncHandler onSelectionAdjusted_;
};
}
