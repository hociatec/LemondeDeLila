#pragma once

#include <functional>
#include <cstddef>

#include <wx/string.h>

#include "modules/options/domain/OptionsState.h"

namespace lila::modules::options::presentation
{
class OptionsEditorController;
class OptionsFocusController;
class OptionsNavigationState;
class OptionsView;

class OptionsSectionCoordinator final
{
public:
    struct Callbacks final
    {
        std::function<void(const wxString&, bool)> updateStatus;
        std::function<void()> onCloseRequested;
    };

    OptionsSectionCoordinator(
        OptionsEditorController& editorController,
        OptionsFocusController& focusController,
        OptionsNavigationState& navigationState,
        OptionsView& view,
        Callbacks callbacks) noexcept;

    void ActivateSection(std::size_t index);
    void LoadState();
    void ApplyState(
        const domain::OptionsState& state,
        bool persist,
        const wxString& successMessage = wxEmptyString);
    void SaveState();
    void CancelChanges();
    void RefreshUnsavedState();
    void HandleEscape();

private:
    void ApplyNavigationState();

    OptionsEditorController& editorController_;
    OptionsFocusController& focusController_;
    OptionsNavigationState& navigationState_;
    OptionsView& view_;
    Callbacks callbacks_;
};
}
