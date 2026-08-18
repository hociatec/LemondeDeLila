#pragma once

#include <functional>
#include <cstddef>
#include <memory>
#include <vector>
#include <wx/frame.h>

#include "modules/options/domain/OptionsState.h"

class wxCheckBox;
class wxSlider;
class wxStaticText;
class wxWindow;

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::shared::ui::controls
{
class VerticalMenu;
}

namespace lila::modules::options::presentation
{
class OptionsView;
class OptionsEditorController;
class OptionsFocusController;

class OptionsFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    OptionsFrame(
        application::OptionsStore& optionsStore,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);
    ~OptionsFrame() override;

private:
    void ActivateSection(std::size_t index);
    void BindEvents();
    void LoadState();
    void ApplyState(
        const domain::OptionsState& state,
        bool persist,
        const wxString& successMessage = wxEmptyString);
    void SaveState();
    void CancelChanges();
    void RefreshUnsavedState();
    void HandleEscape();
    void UpdateStatus(const wxString& message, bool isError = false);

    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    std::unique_ptr<OptionsEditorController> editorController_;
    std::unique_ptr<OptionsFocusController> focusController_;

    OptionsView* view_ = nullptr;
};
}
