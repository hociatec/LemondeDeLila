#include "shared/text/presentation/encoding/Encoding.h"
#include "modules/options/presentation/OptionsFrame.h"
#include "modules/options/presentation/OptionsView.h"
#include "modules/options/presentation/OptionsEditorController.h"
#include "modules/options/presentation/OptionsFocusController.h"
#include "modules/options/presentation/OptionsEventBinder.h"
#include "modules/options/presentation/OptionsSectionCoordinator.h"

#include <utility>

#include <wx/sizer.h>

#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace
{
constexpr int WindowWidth = 960;
constexpr int WindowHeight = 680;
}

namespace lila::modules::options::presentation
{
OptionsFrame::~OptionsFrame() = default;

OptionsFrame::OptionsFrame(
    wxWindow* parent,
    application::OptionsStore& optionsStore,
    CloseRequestedHandler onCloseRequested)
    : lila::shared::accessibility::NonFocusablePanel(
          parent,
          0),
      onCloseRequested_(std::move(onCloseRequested))
{
    SetMinSize(wxSize(WindowWidth, WindowHeight));
    editorController_ = std::make_unique<OptionsEditorController>(optionsStore);
    view_ = new OptionsView(this);
    focusController_ = std::make_unique<OptionsFocusController>(*view_);
    sectionCoordinator_ = std::make_unique<OptionsSectionCoordinator>(
        *editorController_,
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
    UpdateStatus(wxString(L"Aucune modification en attente."));
}

void OptionsFrame::BindEvents()
{
    OptionsEventBinder::Bind(
        *this,
        *view_,
        *focusController_,
        OptionsEventBinder::Handlers{
            [this]() { CancelChanges(); },
            [this]() { RefreshUnsavedState(); },
            [this]() { SaveState(); },
            [this]() { HandleEscape(); }});
    sectionCoordinator_->RefreshUnsavedState();
}

lila::shared::accessibility::FocusManager::Plan OptionsFrame::BuildFocusPlan()
{
    if (focusController_ == nullptr)
    {
        return {};
    }

    return focusController_->BuildSectionTabsPlan();
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
