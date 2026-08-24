#include "shared/ui/presentation/theme/Theme.h"

namespace lila::shared::ui
{
wxColour Theme::Background()
{
    return wxColour(11, 20, 31);
}

wxColour Theme::PanelBackground()
{
    return wxColour(18, 34, 52);
}

wxColour Theme::Accent()
{
    return wxColour(236, 181, 72);
}

wxColour Theme::AccentMuted()
{
    return wxColour(57, 85, 112);
}

wxColour Theme::TextPrimary()
{
    return wxColour(244, 247, 250);
}

wxColour Theme::TextMuted()
{
    return wxColour(170, 184, 199);
}

wxColour Theme::Error()
{
    return wxColour(228, 108, 108);
}

wxFont Theme::TitleFont()
{
    return wxFontInfo(20).FaceName("Segoe UI").Bold();
}

wxFont Theme::BodyFont()
{
    return wxFontInfo(10).FaceName("Segoe UI");
}
}
