#include "modules/about/presentation/AboutFrame.h"
#include "modules/about/presentation/AboutPageCoordinator.h"

#include <wx/button.h>
#include <wx/stattext.h>

#include "shared/accessibility/application/NavigationController.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::about::presentation
{
void AboutFrame::BindEvents()
{
    itemsList_->SetSelectionChangedHandler(
        [this](std::size_t index)
        {
            if (index > 2)
            {
                return;
            }

            (void)index;
        });
    itemsList_->SetActivatedHandler(
        [this](std::size_t index)
        {
            pageCoordinator_->ActivateRootItem(index);
        });

    sendContactButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            UpdateStatus(wxString(L"L'envoi réseau du contact administrateur n'est pas encore disponible dans le client wx."));
        });

    cancelContactButton_->Bind(
        wxEVT_BUTTON,
        [this](wxCommandEvent&)
        {
            HandleEscape();
        });

    lila::shared::accessibility::NavigationController::BindTabNavigation(
        *this,
        [this]() { return BuildTabScope(); });

    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        *this,
        [this]()
        {
            HandleEscape();
            return true;
        });

}

void AboutFrame::HandleEscape()
{
    pageCoordinator_->HandleEscape();
}

void AboutFrame::UpdateStatus(const wxString& message)
{
    statusLabel_->SetLabel(message);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*statusLabel_, message);
    Layout();
}
}
