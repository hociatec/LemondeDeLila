#pragma once
#include <wx/event.h>
#include "modules/shortcuts/domain/Shortcut.h"

namespace lila::modules::shortcuts::presentation
{
inline std::string ShortcutChord(const wxKeyEvent& event)
{
    if (event.MetaDown() || !event.ShiftDown() || event.ControlDown() == event.AltDown()) return {};
    std::string key;
    auto code = event.GetKeyCode();
    if (event.ControlDown() && code >= 1 && code <= 26) code = 'A' + code - 1;
    if (code >= 'a' && code <= 'z') code = 'A' + code - 'a';
    if ((code >= 'A' && code <= 'Z') || (code >= '0' && code <= '9')) key = static_cast<char>(code);
    else if (code >= WXK_F1 && code <= WXK_F12) key = "F" + std::to_string(code - WXK_F1 + 1);
    else return {};
    return std::string(event.ControlDown() ? "CTRL+SHIFT+" : "ALT+SHIFT+") + key;
}
}
