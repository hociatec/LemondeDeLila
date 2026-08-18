#include "shared/text/Encoding.h"
#include "modules/options/presentation/OptionsFrame.h"
#include "modules/options/presentation/OptionsView.h"
#include "modules/options/presentation/OptionsEditorController.h"
#include "modules/options/presentation/OptionsFocusController.h"
#include "modules/options/presentation/OptionsEventBinder.h"
#include "modules/options/presentation/OptionsEventBinder.inl"

#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/gbsizer.h>
#include <wx/event.h>
#include <wx/panel.h>
#include <wx/sizer.h>
#include <wx/simplebook.h>
#include <wx/slider.h>
#include <wx/statbox.h>
#include <wx/stattext.h>

#include "modules/options/application/OptionsStore.h"
#include "shared/accessibility/AccessibilityUtils.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "shared/config/AppConfig.h"
#include "shared/ui/controls/VerticalMenu.h"
#include "shared/ui/navigation/MenuBlueprint.h"
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
          wxString::Format(
              wxString(L"Options - %s"),
              lila::shared::text::FromUtf8(shared::config::AppConfig::AppTitle.data())),
          wxDefaultPosition,
          wxSize(WindowWidth, WindowHeight),
          wxDEFAULT_FRAME_STYLE),
      onCloseRequested_(std::move(onCloseRequested)),
      onExitRequested_(std::move(onExitRequested))
{
    editorController_ = std::make_unique<OptionsEditorController>(optionsStore);
    view_ = new OptionsView(this, [this]() { SaveState(); });
    focusController_ = std::make_unique<OptionsFocusController>(*view_);
    auto* frameSizer = new wxBoxSizer(wxVERTICAL);
    frameSizer->Add(view_, 1, wxEXPAND);
    SetSizer(frameSizer);
    view_->ApplyTheme();
    BindEvents();
    LoadState();
    CentreOnScreen();
    UpdateStatus(wxString(L"Modifiez les options puis Enregistrer."));
    CallAfter(
        [this]()
        {
            if (view_->sectionsMenu != nullptr)
            {
                view_->sectionsMenu->SetSelectedIndex(0);
                view_->sectionsMenu->FocusFirstItem();
            }
        });
}







void OptionsFrame::ActivateSection(std::size_t index)
{
    if (view_->sectionBook == nullptr)
    {
        return;
    }

    const int pageCount = view_->sectionBook->GetPageCount();
    if (pageCount <= 0 || index >= static_cast<std::size_t>(pageCount))
    {
        return;
    }

    view_->sectionBook->SetSelection(static_cast<int>(index));
    editorController_->EnterSection();
    if (view_->sectionsMenu != nullptr)
    {
        if (view_->sectionsMenu->GetSelectedIndex() != index)
        {
            view_->sectionsMenu->SetSelectedIndex(index);
        }
    }
    focusController_->FocusFirstSectionControl(index);
}













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
            [this]() { return editorController_->IsInsideSection(); },
            [this]()
            {
                if (onExitRequested_)
                {
                    onExitRequested_();
                }
            }});
    RefreshUnsavedState();
}

void OptionsFrame::LoadState()
{
    const auto initialState = editorController_->Load();
    ApplyState(initialState, false);
    RefreshUnsavedState();
}

void OptionsFrame::ApplyState(const domain::OptionsState& state, bool persist, const wxString& successMessage)
{
    view_->WriteState(state);

    if (persist)
    {
        try
        {
            editorController_->Save(state);
            UpdateStatus(successMessage.empty() ? wxString(L"Options enregistrées.") : successMessage, false);
        }
        catch (const std::exception& error)
        {
            UpdateStatus(lila::shared::text::FromUtf8(error.what()), true);
        }

        return;
    }

    if (!successMessage.empty())
    {
        UpdateStatus(successMessage, false);
    }
}

void OptionsFrame::SaveState()
{
    ApplyState(view_->ReadState(editorController_->BaseState()), true, wxString(L"Options enregistrées."));
    RefreshUnsavedState();
}

void OptionsFrame::CancelChanges()
{
    ApplyState(editorController_->CancelState(), false, wxString(L"Modifications annulées."));
    RefreshUnsavedState();
}

void OptionsFrame::RefreshUnsavedState()
{
    const auto stateFromControls = view_->ReadState(editorController_->BaseState());
    const bool hasUnsavedChanges = editorController_->HasUnsavedChanges(stateFromControls);

    view_->SetUnsavedChanges(hasUnsavedChanges);

    if (hasUnsavedChanges)
    {
        UpdateStatus(wxString(L"Modifications en attente d'enregistrement."), false);
        return;
    }

    UpdateStatus(wxString(L"Aucune modification en attente."), false);
}

void OptionsFrame::HandleEscape()
{
    if (editorController_->IsInsideSection())
    {
        editorController_->LeaveSection();
        if (view_->sectionsMenu != nullptr)
        {
            if (view_->sectionBook != nullptr)
            {
                const int currentSection = view_->sectionBook->GetSelection();
                if (currentSection >= 0)
                {
                    view_->sectionsMenu->SetSelectedIndex(static_cast<std::size_t>(currentSection));
                }
            }
            view_->sectionsMenu->FocusSelectedItem();
        }
        return;
    }

    if (onCloseRequested_ != nullptr)
    {
        onCloseRequested_();
    }
}

void OptionsFrame::UpdateStatus(const wxString& message, bool isError)
{
    view_->statusLabel->SetLabel(message);
    view_->statusLabel->SetForegroundColour(isError ? wxColour(240, 130, 130) : lila::shared::ui::Theme::Accent());
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*view_->statusLabel, message);
    Layout();
}

}


#include "modules/options/presentation/OptionsView.inl"


#include "modules/options/presentation/OptionsFocusController.inl"
