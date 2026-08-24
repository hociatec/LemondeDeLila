#include "shared/text/Encoding.h"
#include "modules/options/presentation/OptionsSectionCoordinator.h"

#include <exception>
#include <utility>

#include <wx/simplebook.h>

#include "modules/options/presentation/OptionsEditorController.h"
#include "modules/options/presentation/OptionsFocusController.h"
#include "modules/options/presentation/OptionsNavigationState.h"
#include "modules/options/presentation/OptionsView.h"
#include "shared/errors/ErrorMessages.h"
#include "shared/logging/Logger.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::options::presentation
{
OptionsSectionCoordinator::OptionsSectionCoordinator(
    OptionsEditorController& editorController,
    OptionsFocusController& focusController,
    OptionsNavigationState& navigationState,
    OptionsView& view,
    Callbacks callbacks) noexcept
    : editorController_(editorController),
      focusController_(focusController),
      navigationState_(navigationState),
      view_(view),
      callbacks_(std::move(callbacks))
{
}

void OptionsSectionCoordinator::ActivateSection(std::size_t index)
{
    if (navigationState_.insideSection && navigationState_.currentSectionIndex == index)
    {
        ApplyNavigationState();
        return;
    }
    focusTransition_.Remember(CurrentFocusScope());
    navigationState_.EnterSection(index);
    ApplyNavigationState();
}

void OptionsSectionCoordinator::ApplyNavigationState()
{
    const auto shell = view_.Shell();
    if (shell.sectionsMenu == nullptr)
    {
        return;
    }

    shell.sectionsMenu->SetSelectedIndexSilently(navigationState_.currentSectionIndex);
    if (!navigationState_.insideSection)
    {
        focusTransition_.Schedule(
            view_,
            shell.sectionsPanel,
            [this]()
            {
                return focusController_.BuildSectionMenuPlan(navigationState_.currentSectionIndex);
            });
        return;
    }

    if (shell.sectionBook == nullptr)
    {
        return;
    }

    const int pageCount = shell.sectionBook->GetPageCount();
    if (pageCount <= 0 || navigationState_.currentSectionIndex >= static_cast<std::size_t>(pageCount))
    {
        return;
    }

    shell.sectionBook->ChangeSelection(static_cast<int>(navigationState_.currentSectionIndex));
    wxWindow* sectionPage = shell.sectionBook->GetPage(navigationState_.currentSectionIndex);
    focusTransition_.Schedule(
        view_,
        sectionPage,
        [this]()
        {
            return focusController_.BuildFirstSectionControlPlan(navigationState_.currentSectionIndex);
        });
}

void OptionsSectionCoordinator::LoadState()
{
    const auto initialState = editorController_.Load();
    ApplyState(initialState, false);
    RefreshUnsavedState();
}

void OptionsSectionCoordinator::ApplyState(
    const domain::OptionsState& state,
    bool persist,
    const wxString& successMessage)
{
    view_.WriteState(state);

    if (persist)
    {
        try
        {
            editorController_.Save(state);
            callbacks_.updateStatus(successMessage.empty() ? wxString(L"Options enregistrees.") : successMessage, false);
        }
        catch (const std::exception& error)
        {
            lila::shared::logging::LogError("Options", error.what());
            callbacks_.updateStatus(lila::shared::text::FromUtf8(lila::shared::errors::OptionsSaveFailed), true);
        }

        return;
    }

    if (!successMessage.empty())
    {
        callbacks_.updateStatus(successMessage, false);
    }
}

void OptionsSectionCoordinator::SaveState()
{
    ApplyState(view_.ReadState(editorController_.BaseState()), true, wxString(L"Options enregistrées."));
    RefreshUnsavedState();
}

void OptionsSectionCoordinator::CancelChanges()
{
    ApplyState(editorController_.CancelState(), false, wxString(L"Modifications annulées."));
    RefreshUnsavedState();
    if (callbacks_.onCloseRequested)
    {
        callbacks_.onCloseRequested();
    }
}

void OptionsSectionCoordinator::RefreshUnsavedState()
{
    const auto stateFromControls = view_.ReadState(editorController_.BaseState());
    const bool hasUnsavedChanges = editorController_.HasUnsavedChanges(stateFromControls);

    view_.SetUnsavedChanges(hasUnsavedChanges);
    if (hasUnsavedChanges)
    {
        callbacks_.updateStatus(wxString(L"Modifications non enregistrees."), false);
        return;
    }

    callbacks_.updateStatus(wxString(L"Aucune modification en attente."), false);
}

void OptionsSectionCoordinator::HandleEscape()
{
    CancelChanges();
}

wxWindow* OptionsSectionCoordinator::CurrentFocusScope() const
{
    const auto shell = view_.Shell();
    if (!navigationState_.insideSection || shell.sectionBook == nullptr)
    {
        return shell.sectionsPanel;
    }

    const int pageCount = shell.sectionBook->GetPageCount();
    if (navigationState_.currentSectionIndex >= static_cast<std::size_t>(pageCount))
    {
        return nullptr;
    }

    return shell.sectionBook->GetPage(navigationState_.currentSectionIndex);
}
}
