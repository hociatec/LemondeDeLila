#include "modules/options/presentation/OptionsView.h"

#include <span>
#include <utility>
#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/gbsizer.h>
#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/simplebook.h>
#include <wx/slider.h>
#include <wx/statbox.h>
#include <wx/stattext.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
#include "shared/ui/Theme.h"

namespace
{
constexpr int SectionMenuMinWidth = 220;
}

namespace lila::modules::options::presentation
{
OptionsView::OptionsView(wxWindow* parent, SaveRequestedHandler onSave)
    : wxPanel(parent),
      onSave_(std::move(onSave))
{
    BuildLayout();
}

#include "modules/options/presentation/OptionsView.Layout.inl"
#include "modules/options/presentation/OptionsView.State.inl"
#include "modules/options/presentation/OptionsView.Pages.inl"
#include "modules/options/presentation/OptionsView.Theme.inl"
}
