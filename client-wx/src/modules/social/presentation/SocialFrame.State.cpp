#include "modules/social/presentation/SocialFrame.h"

#include <functional>
#include <stdexcept>

#include <wx/msgdlg.h>
#include <wx/weakref.h>

#include "modules/social/presentation/SocialView.h"
#include "shared/accessibility/application/FocusManager.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/application/BackgroundTask.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
lila::shared::accessibility::FocusManager::Plan SocialFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    if (navigationState_.currentScreen == Screen::Menu)
    {
        plan.AddResolver([this]() { return ResolveMenuFocusTarget(); });
    }
    else if (navigationState_.currentSection == SocialSection::Profile)
    {
        plan.AddScope([this]() { return BuildFocusScope(); });
    }
    else
    {
        if (navigationState_.sectionActionMenuActive)
        {
            const auto controls = view_->SectionFor(navigationState_.currentSection);
            plan.AddWindow(controls.actionsMenu != nullptr ? controls.actionsMenu->GetFirstButton() : nullptr);
        }
        plan.AddResolver([this]() { return ResolveCurrentSectionTarget(); });
    }

    return plan;
}

void SocialFrame::RunUiAction(const std::function<void()>& action)
{
    try
    {
        action();
    }
    catch (const std::exception& error)
    {
        lila::shared::logging::LogError("Social", error.what());
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::UnexpectedError), true);
    }
}

void SocialFrame::ShowActionFeedback(const wxString& message, const wxString& title)
{
    UpdateStatus(message);
    wxMessageBox(message, title, wxOK | wxICON_INFORMATION, this);
}

void SocialFrame::ArmInitialListActivationSuppression() noexcept
{
    if (navigationState_.currentScreen == Screen::Section && !navigationState_.sectionActionMenuActive)
    {
        suppressNextListActivation_ = true;
    }
}

bool SocialFrame::ConsumePendingListActivationSuppression() noexcept
{
    if (!suppressNextListActivation_)
    {
        return false;
    }

    suppressNextListActivation_ = false;
    return true;
}

void SocialFrame::RunBackgroundTask(
    const wxString& busyMessage,
    const std::function<void()>& worker,
    const std::function<void()>& onSuccess,
    bool announceBusy)
{
    if (isBusy_)
    {
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    SetBusyState(true, busyMessage, announceBusy);
    wxWeakRef<SocialFrame> weakSelf(this);
    lila::shared::ui::RunBackgroundTask(
        this,
        worker,
        [weakSelf, onSuccess](std::string errorMessage) mutable
        {
            if (!weakSelf)
            {
                return;
            }

            weakSelf->SetBusyState(false);
            if (!errorMessage.empty())
            {
                weakSelf->UpdateStatus(lila::shared::text::FromUtf8(errorMessage), true);
                return;
            }

            if (onSuccess)
            {
                weakSelf->RunUiAction(onSuccess);
            }
        });
}

void SocialFrame::SetBusyState(bool busy, const wxString& message, bool announce)
{
    isBusy_ = busy;
    if (busy && !message.empty())
    {
        UpdateStatus(message, false, announce);
    }

    ApplyBusyState();
}

void SocialFrame::ApplyBusyState()
{
    // Ne pas dÃ©sactiver les contrÃ´les pendant les chargements :
    // le lecteur d'Ã©cran annonce alors "indisponible" sur les Ã©crans sociaux.
}
}

