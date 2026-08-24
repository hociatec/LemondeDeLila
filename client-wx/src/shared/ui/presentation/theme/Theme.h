#pragma once

#include <wx/colour.h>
#include <wx/font.h>

namespace lila::shared::ui
{
struct Theme final
{
    static wxColour Background();
    static wxColour PanelBackground();
    static wxColour Accent();
    static wxColour AccentMuted();
    static wxColour TextPrimary();
    static wxColour TextMuted();
    static wxColour Error();
    static wxFont TitleFont();
    static wxFont BodyFont();
};
}
