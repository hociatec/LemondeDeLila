#include <wx/event.h>
#include <wx/sizer.h>

#include "modules/options/presentation/OptionsView.h"
#include "modules/options/presentation/OptionsViewPagesBuilder.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"

namespace lila::modules::options::presentation
{
void OptionsView::BuildGeneralPage(wxWindow* parent)
{
    OptionsViewPagesBuilder::BuildGeneralPage(*this, parent);
}

void OptionsView::BuildSoundsPage(wxWindow* parent)
{
    OptionsViewPagesBuilder::BuildSoundsPage(*this, parent);
}

void OptionsView::BuildChatPage(wxWindow* parent)
{
    OptionsViewPagesBuilder::BuildChatPage(*this, parent);
}

}
