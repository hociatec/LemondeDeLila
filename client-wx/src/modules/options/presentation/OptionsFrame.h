#pragma once

#include <functional>
#include <memory>

#include <wx/string.h>

#include "shared/accessibility/application/FocusPlanView.h"
#include "shared/accessibility/presentation/NonFocusablePanel.h"

class wxWindow;

namespace lila::modules::options::application
{
class OptionsStore;
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
    void BindEvents();
    void SaveState();
    void CancelChanges();
    void RefreshUnsavedState();
    void HandleEscape();
    void UpdateStatus(const wxString& message, bool isError = false);

    CloseRequestedHandler onCloseRequested_;
    std::unique_ptr<OptionsEditorController> editorController_;
    std::unique_ptr<OptionsFocusController> focusController_;
    std::unique_ptr<OptionsSectionCoordinator> sectionCoordinator_;

    OptionsView* view_ = nullptr;
};
}
