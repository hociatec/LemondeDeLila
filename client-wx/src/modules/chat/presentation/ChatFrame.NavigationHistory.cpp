#include "modules/chat/presentation/ChatFrame.h"

#include <wx/textctrl.h>

#include "modules/chat/presentation/ChatFocusController.h"
#include "modules/options/application/OptionsStore.h"
#include "shared/accessibility/application/FocusCoordinator.h"
#include "shared/text/presentation/catalog/UiTexts.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::chat::presentation
{
void ChatFrame::ClearNavigationHistory()
{
    navigationHistory_.Clear();
}

void ChatFrame::PushNavigationSnapshot()
{
    navigationHistory_.Push(NavigationSnapshot{
        isHistoryActionMode_,
        selectedActionMessageId_,
        pendingEditMessageId_,
    });
}

bool ChatFrame::NavigateBack()
{
    if (navigationHistory_.Empty())
    {
        return false;
    }

    const NavigationSnapshot snapshot = navigationHistory_.Pop();
    ApplyNavigationSnapshot(snapshot);
    return true;
}

void ChatFrame::ApplyNavigationSnapshot(const NavigationSnapshot& snapshot)
{
    const bool wasEditing = pendingEditMessageId_.has_value();

    isHistoryActionMode_ = snapshot.isHistoryActionMode;
    selectedActionMessageId_ = snapshot.selectedActionMessageId;
    pendingEditMessageId_ = snapshot.pendingEditMessageId;

    if (!pendingEditMessageId_.has_value())
    {
        inputCtrl_->Clear();
        inputCtrl_->SetHint(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditHint));
    }

    if (wasEditing && !pendingEditMessageId_.has_value())
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::text::ui::ChatEditAborted));
    }

    SyncActionState();
    if (isHistoryActionMode_)
    {
        static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildFirstHistoryActionPlan()));
        return;
    }

    static_cast<void>(lila::shared::accessibility::FocusCoordinator::Apply(focusController_->BuildComposerPlan()));
}
}
