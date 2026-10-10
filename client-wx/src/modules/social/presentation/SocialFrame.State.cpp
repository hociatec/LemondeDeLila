#include "modules/social/presentation/SocialFrame.h"

#include <functional>
#include <stdexcept>
#include <utility>

#include <wx/msgdlg.h>
#include <wx/textctrl.h>

#include "modules/social/presentation/SocialView.h"
#include "shared/accessibility/presentation/FocusManager.h"
#include "shared/errors/catalog/CoreErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/BackgroundTask.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::social::presentation
{
void SocialFrame::RefreshForNavigation()
{
    // Do not overwrite a profile the user is editing after visiting an overlay.
    if (navigationState_.currentScreen == Screen::Section &&
        navigationState_.currentSection != SocialSection::Profile)
        RefreshCurrentSection();
}

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

void SocialFrame::RunBackgroundTask(
    const wxString& busyMessage,
    const std::function<void()>& worker,
    const std::function<void()>& onSuccess,
    bool announceBusy,
    bool readOnly)
{
    const auto generation = readOnly ? ++readGeneration_ : readGeneration_;
    if (isBusy_)
    {
        if (readOnly)
        {
            pendingRead_ = [this, busyMessage, worker, onSuccess, announceBusy]()
            { RunBackgroundTask(busyMessage, worker, onSuccess, announceBusy, true); };
            return;
        }
        UpdateStatus(lila::shared::text::FromUtf8(lila::shared::errors::ActionInProgress), true);
        return;
    }

    if (readOnly) pendingRead_ = {};
    SetBusyState(true, busyMessage, announceBusy);
    lila::shared::ui::RunBackgroundTask(
        this,
        worker,
        [this, weakThis = wxWeakRef<SocialFrame>(this), generation, readOnly, onSuccess](std::string errorMessage)
        {
            SetBusyState(false);
            if (!readOnly || generation == readGeneration_)
            {
                if (!errorMessage.empty())
                    UpdateStatus(lila::shared::text::FromUtf8(errorMessage), true);
                else if (onSuccess) RunUiAction(onSuccess);
            }
            if (weakThis && !isBusy_ && pendingRead_)
            {
                auto next = std::exchange(pendingRead_, {});
                next();
            }
        });
}

void SocialFrame::SetBusyState(bool busy, const wxString& message, bool announce)
{
    isBusy_ = busy;
    if (!busy && loadingPlaceholder_ != nullptr)
    {
        loadingPlaceholder_->ChangeValue(loadingPlaceholderText_);
        loadingPlaceholder_ = nullptr;
    }
    if (busy && !message.empty())
    {
        const auto controls = view_->SectionFor(navigationState_.currentSection);
        if (navigationState_.currentScreen == Screen::Section && controls.list != nullptr &&
            controls.list->GetItemCount() == 0 && controls.emptyControl != nullptr)
        {
            loadingPlaceholder_ = controls.emptyControl;
            loadingPlaceholderText_ = loadingPlaceholder_->GetValue();
            // Its accessible name already identifies the section. Keep the
            // value neutral until the result is known, without a spoken wait.
            loadingPlaceholder_->ChangeValue(wxEmptyString);
        }
        UpdateStatus(announce ? message : wxString{}, false, announce);
    }

    ApplyBusyState();
}

void SocialFrame::ApplyBusyState()
{
    // Ne pas désactiver les contrôles pendant les chargements :
    // le lecteur d'écran annonce alors « indisponible » sur les écrans sociaux.
}
}
