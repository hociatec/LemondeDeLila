#include "modules/options/presentation/OptionsSectionCoordinator.h"

#include <exception>
#include <utility>

#include "modules/options/presentation/OptionsEditorController.h"
#include "modules/options/presentation/OptionsView.h"
#include "shared/errors/catalog/ErrorMessages.h"
#include "shared/logging/application/Logger.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::options::presentation
{
OptionsSectionCoordinator::OptionsSectionCoordinator(
    OptionsEditorController& editorController,
    OptionsView& view,
    Callbacks callbacks) noexcept
    : editorController_(editorController),
      view_(view),
      callbacks_(std::move(callbacks))
{
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
            callbacks_.updateStatus(
                successMessage.empty() ? wxString(L"Options enregistrées.") : successMessage,
                false);
        }
        catch (const std::exception& error)
        {
            lila::shared::logging::LogError("Options", error.what());
            callbacks_.updateStatus(
                lila::shared::text::FromUtf8(lila::shared::errors::OptionsSaveFailed),
                true);
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
        callbacks_.updateStatus(wxString(L"Modifications non enregistrées."), false);
        return;
    }

    callbacks_.updateStatus(wxString(L"Aucune modification en attente."), false);
}

void OptionsSectionCoordinator::HandleEscape()
{
    CancelChanges();
}
}
