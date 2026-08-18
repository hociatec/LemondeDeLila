#include "modules/social/presentation/SocialView.h"
#include <array>
#include <vector>
#include <wx/button.h>
#include <wx/choice.h>
#include <wx/simplebook.h>
#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/ui/Theme.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
namespace lila::modules::social::presentation {
#include "modules/social/presentation/SocialView.Layout.inl"
#include "modules/social/presentation/SocialView.ListSections.inl"
#include "modules/social/presentation/SocialView.Profile.inl"
#include "modules/social/presentation/SocialView.Theme.inl"
}
