#pragma once

#include <functional>

#include <wx/string.h>

#include "modules/options/domain/OptionsState.h"

namespace lila::modules::options::presentation
{
class OptionsEditorController;
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
        OptionsView& view,
        Callbacks callbacks) noexcept;

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
    OptionsEditorController& editorController_;
    OptionsView& view_;
    Callbacks callbacks_;
};
}
