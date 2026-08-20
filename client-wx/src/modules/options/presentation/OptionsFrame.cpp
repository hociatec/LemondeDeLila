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
#include <wx/event.h>
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
    application::OptionsStore& optionsStore,
    CloseRequestedHandler onCloseRequested,
    ExitRequestedHandler onExitRequested)
    : wxFrame(
          nullptr,
          wxID_ANY,
          wxString(L"Options - ") + lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data()),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    editorController_ = std::make_unique<OptionsEditorController>(optionsStore);
    view_ = new OptionsView(this, [this]() { SaveState(); });
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
    CentreOnScreen();
    UpdateStatus(wxString(L"Modifiez les options puis Enregistrer."));
    CallAfter(
        [this]()
        {
            const auto shell = view_->Shell();
            if (shell.sectionsMenu != nullptr)
            {
                shell.sectionsMenu->SetSelectedIndexSilently(0);
                navigationState_.SetCurrentSection(0);
                shell.sectionsMenu->FocusFirstItem();
            }
        });
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
            [this]() { CancelChanges(); },
            [this]() { RefreshUnsavedState(); },
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
