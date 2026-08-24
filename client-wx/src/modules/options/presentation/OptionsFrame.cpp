#include "shared/text/Encoding.h"
#include "modules/options/presentation/OptionsFrame.h"
#include "modules/options/presentation/OptionsView.h"
#include "modules/options/presentation/OptionsEditorController.h"
#include "modules/options/presentation/OptionsFocusController.h"
#include "modules/options/presentation/OptionsEventBinder.h"
#include "modules/options/presentation/OptionsSectionCoordinator.h"

#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/gbsizer.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/Theme.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 780;
}

namespace lila::modules::options::presentation
{
OptionsFrame::~OptionsFrame() = default;

OptionsFrame::OptionsFrame(
    wxWindow* parent,
    application::OptionsStore& optionsStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : lila::shared::accessibility::NonFocusablePanel(
          parent,
          0),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
    editorController_ = std::make_unique<OptionsEditorController>(optionsStore);
    view_ = new OptionsView(this);
    focusController_ = std::make_unique<OptionsFocusController>(*view_);
    sectionCoordinator_ = std::make_unique<OptionsSectionCoordinator>(
        *editorController_,
        *focusController_,
        navigationState_,
        *view_,
        OptionsSectionCoordinator::Callbacks{
            [this](const wxString& message, bool isError)
            {
                UpdateStatus(message, isError);
            },
            [this]()
            {
                if (onCloseRequested_ != nullptr)
                {
                    onCloseRequested_();
                }
            }});
    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(view_, 1, wxEXPAND);
    SetSizer(frameSizer);
    view_->ApplyTheme();
    BindEvents();
    sectionCoordinator_->LoadState();
    UpdateStatus(wxString(L"Les options sont enregistrees automatiquement."));
}







void OptionsFrame::ActivateSection(std::size_t index) { sectionCoordinator_->ActivateSection(index); }













void OptionsFrame::BindEvents()
{
    OptionsEventBinder::Bind(
        *this,
        *view_,
        *focusController_,
        OptionsEventBinder::Handlers{
            [this](std::size_t index) { ActivateSection(index); },
            [this](std::size_t index) { navigationState_.SetCurrentSection(index); },
            [this]() { CancelChanges(); },
            [this]() { SaveState(); },
            [this]() { HandleEscape(); },
            [this]() { return navigationState_.insideSection; },
            [this]()
            {
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
    sectionCoordinator_->RefreshUnsavedState();
}

lila::shared::accessibility::FocusManager::Plan OptionsFrame::BuildFocusPlan()
{
    if (focusController_ == nullptr)
    {
        return {};
    }

    if (navigationState_.insideSection)
    {
        return focusController_->BuildFirstSectionControlPlan(navigationState_.currentSectionIndex);
    }

    const auto shell = view_->Shell();
    if (shell.sectionsMenu != nullptr)
    {
        if (navigationState_.currentSectionIndex >= shell.sectionsMenu->GetItemCount())
        {
            navigationState_.SetCurrentSection(0);
        }
        return focusController_->BuildSectionMenuPlan(navigationState_.currentSectionIndex);
    }
    return {};
}

void OptionsFrame::LoadState() { sectionCoordinator_->LoadState(); }

void OptionsFrame::ApplyState(const domain::OptionsState& state, bool persist, const wxString& successMessage)
{
    sectionCoordinator_->ApplyState(state, persist, successMessage);
}

void OptionsFrame::SaveState() { sectionCoordinator_->SaveState(); }

void OptionsFrame::CancelChanges() { sectionCoordinator_->CancelChanges(); }

void OptionsFrame::RefreshUnsavedState() { sectionCoordinator_->RefreshUnsavedState(); }

void OptionsFrame::HandleEscape() { sectionCoordinator_->HandleEscape(); }

void OptionsFrame::UpdateStatus(const wxString& message, bool isError)
{
    const auto shell = view_->Shell();
    shell.statusLabel->SetLabel(message);
    shell.statusLabel->SetForegroundColour(isError ? wxColour(240, 130, 130) : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*shell.statusLabel, message);
    Layout();
}

}
