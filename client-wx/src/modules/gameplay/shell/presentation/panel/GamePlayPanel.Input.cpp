#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include <wx/event.h>
#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"

#include "modules/gameplay/grid/presentation/GameGridPanel.h"
#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"
#include "modules/gameplay/shortcuts/application/GameGenericShortcutPolicy.h"
#include "shared/text/presentation/encoding/Encoding.h"
namespace lila::modules::gameplay::presentation
{
bool GamePlayPanel::HandleKey(wxKeyEvent& event)
{
    if (const auto lifecycle = HandleInputLifecycle(event); lifecycle)
        return *lifecycle;
    const auto key = NormalizeKey(event);
    const auto genericPanel =
        application::shortcuts::GameGenericShortcutPolicy::ResolveInterface(state_, key);
    if (!genericPanel.empty())
    {
        const auto message = application::info::GameCapabilityTextBuilder::Build(
            state_, genericPanel);
        if (!message.empty()) UpdateStatus(FromUtf8(message), false, true);
        return true;
    }
    if (inputSubmissionGuard_.IsInFlight())
    {
        if (keyCode == WXK_F5)
        {
            RequestRefresh();
        }
        return true;
    }
    if (pawnSelectionPanel_->IsActive())
    {
        return pawnSelectionPanel_->HandleKey(event);
    }
    const int keyCode = event.GetKeyCode();
    // Tab belongs to RoomPanel's two-zone navigation. Handling it here would
    // trap the keyboard inside the hand because this panel uses CHAR_HOOK.
    if (keyCode == WXK_TAB || keyCode == WXK_NUMPAD_TAB) return false;
    if (gridPanel_->HandleKey(event)) return true;

    if (HandleTableShortcut(event)) return true;

    if (event.IsAutoRepeat() && key != "F5") return true;

    if (key == "ENTER")
    {
        return HandleFocusedActivation();
    }
    if (key == "D")
        if (AnnounceSelectedHandCard()) return true;
    if (key == "F5")
    {
        RequestRefresh();
        return true;
    }
    if (HandleShortcut(key)) return true;
    // A game may reserve I for its own inventory. Without such a declaration,
    // let RoomPanel keep its usual information shortcut.
    if (key == "I") return false;
    // An unconfigured key is deliberately silent and must not create a
    // protocol request or a generic server error.
    return true;
}

}
