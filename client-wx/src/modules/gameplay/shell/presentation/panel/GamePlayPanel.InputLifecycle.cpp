#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"

#include <wx/event.h>

#include "modules/gameplay/actions/presentation/confirmation/GameActionConfirmationPanel.h"
#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

namespace lila::modules::gameplay::presentation
{
std::optional<bool> GamePlayPanel::HandleInputLifecycle(wxKeyEvent& event)
{
    const int keyCode = event.GetKeyCode();
    if (event.AltDown() && keyCode == WXK_F4) return false;
    if (!IsOpen() || IsFinished()) return false;
    // A hidden lobby projection must never capture the table's keyboard,
    // including when the post-game refresh fails or has not arrived yet.
    if (!lifecycle_.IsVisible()) return false;
    if (!lifecycle_.HasAuthoritativeState())
    {
        if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB) return false;
        if (HandleTableShortcut(event)) return true;
        if (keyCode == WXK_F5) RequestRefresh();
        return true;
    }
    if (IsConfirmationVisible()) return confirmationPanel_->HandleKey(event);
    if (IsInlinePromptVisible()) return promptPanel_->HandleKey(event);
    const auto key = NormalizeKey(event);
    if (key.empty() || !lifecycle_.IsRoomStarted()) return false;
    if (!lifecycle_.IsAwaitingStartedState()) return std::nullopt;
    if (keyCode == WXK_F5)
    {
        RequestRefresh();
        return true;
    }
    return ShouldCaptureWhileAwaitingStartedState(key);
}
}
