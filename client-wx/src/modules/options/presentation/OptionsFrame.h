#pragma once

#include <functional>
#include <cstddef>
#include <memory>
#include <vector>

#include "shared/accessibility/FocusPlanView.h"
#include "shared/accessibility/NonFocusablePanel.h"
#include "modules/options/domain/OptionsState.h"
#include "modules/options/presentation/OptionsNavigationState.h"

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
class OptionsSectionCoordinator;

class OptionsFrame final : public lila::shared::accessibility::NonFocusablePanel, public lila::shared::accessibility::FocusPlanView
{
public:
    using CloseRequestedHandler = std::function<void()>;

    OptionsFrame(
        wxWindow* parent,
        application::OptionsStore& optionsStore,
        CloseRequestedHandler onCloseRequested);
    ~OptionsFrame() override;
    [[nodiscard]] lila::shared::accessibility::FocusManager::Plan BuildFocusPlan() override;

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
    OptionsNavigationState navigationState_;
    std::unique_ptr<OptionsEditorController> editorController_;
    std::unique_ptr<OptionsFocusController> focusController_;
    std::unique_ptr<OptionsSectionCoordinator> sectionCoordinator_;

    OptionsView* view_ = nullptr;
};
}
