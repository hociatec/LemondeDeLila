#pragma once

#include <functional>
#include <cstddef>
#include <vector>
#include <wx/frame.h>

#include "modules/options/domain/OptionsState.h"

class wxButton;
class wxCheckBox;
class wxBoxSizer;
class wxPanel;
class wxSimplebook;
class wxSlider;
class wxStaticText;
class wxWindow;

namespace lila::modules::options::application
{
class OptionsStore;
}

namespace lila::modules::session::application
{
class SessionStore;
}

namespace lila::shared::ui::controls
{
class VerticalMenu;
}

namespace lila::modules::options::presentation
{
class OptionsFrame final : public wxFrame
{
public:
    using CloseRequestedHandler = std::function<void()>;
    using ExitRequestedHandler = std::function<void()>;

    OptionsFrame(
        application::OptionsStore& optionsStore,
        lila::modules::session::application::SessionStore& sessionStore,
        CloseRequestedHandler onCloseRequested,
        ExitRequestedHandler onExitRequested);

private:
    void BuildLayout();
    void BuildSectionMenu(wxWindow* parent);
    void BuildSectionPages(wxWindow* parent);
    void BuildGeneralPage(wxWindow* parent);
    void BuildSoundsPage(wxWindow* parent);
    void BuildChatPage(wxWindow* parent);
    [[nodiscard]] wxWindow* GetFirstSectionControl(std::size_t sectionIndex) const;
    void ActivateSection(std::size_t index);
    void ApplyTheme();
    void BindEvents();
    void BindSliderStatus(wxSlider& slider, wxStaticText& label, const wxString& prefix);
    void BindSliderStatusEvents();
    void BindImmediateApply(wxCheckBox& checkbox);
    void LoadState();
    [[nodiscard]] domain::OptionsState BuildStateFromControls() const;
    void ApplyState(
        const domain::OptionsState& state,
        bool persist,
        const wxString& successMessage = wxEmptyString);
    void SaveState();
    void CancelChanges();
    void RefreshUnsavedState();
    void HandleEscape();
    void UpdateSoundControlInteractivity();
    [[nodiscard]] bool TryNavigateSectionControls(int keyCode, bool reverseTabNavigation);
    void AddSectionSaveButton(wxWindow* parent, wxBoxSizer* sectionSizer);
    [[nodiscard]] bool HasUnsavedChanges() const;
    void UpdateStatus(const wxString& message, bool isError = false);

    application::OptionsStore& optionsStore_;
    lila::modules::session::application::SessionStore& sessionStore_;
    CloseRequestedHandler onCloseRequested_;
    ExitRequestedHandler onExitRequested_;
    domain::OptionsState initialState_;

    lila::shared::ui::controls::VerticalMenu* sectionsMenu_ = nullptr;
    wxSimplebook* sectionBook_ = nullptr;
    wxPanel* sectionsPanel_ = nullptr;
    wxStaticText* statusLabel_ = nullptr;
    bool isInsideSection_ = false;

    wxCheckBox* confirmExitCheckbox_ = nullptr;
    wxCheckBox* repairBrokenAccentsCheckbox_ = nullptr;
    wxCheckBox* enableBetaGamesCheckbox_ = nullptr;

    wxCheckBox* muteAllCheckbox_ = nullptr;
    wxCheckBox* soundAmbienceCheckbox_ = nullptr;
    wxCheckBox* soundAppLaunchCheckbox_ = nullptr;
    wxCheckBox* soundNavigateCheckbox_ = nullptr;
    wxCheckBox* soundSelectCheckbox_ = nullptr;
    wxCheckBox* soundChatMessagesCheckbox_ = nullptr;

    wxSlider* soundMenuAmbienceSlider_ = nullptr;
    wxSlider* soundTavernAmbienceSlider_ = nullptr;
    wxSlider* soundAppLaunchSlider_ = nullptr;
    wxSlider* soundNavigateSlider_ = nullptr;
    wxSlider* soundSelectSlider_ = nullptr;
    wxSlider* soundChatMessagesSlider_ = nullptr;

    wxStaticText* soundMenuAmbienceValueLabel_ = nullptr;
    wxStaticText* soundTavernAmbienceValueLabel_ = nullptr;
    wxStaticText* soundAppLaunchValueLabel_ = nullptr;
    wxStaticText* soundNavigateValueLabel_ = nullptr;
    wxStaticText* soundSelectValueLabel_ = nullptr;
    wxStaticText* soundChatMessagesValueLabel_ = nullptr;

    wxCheckBox* chatEnabledCheckbox_ = nullptr;
    wxCheckBox* confirmChatExitCheckbox_ = nullptr;
    wxCheckBox* restoreSessionCheckbox_ = nullptr;
    wxCheckBox* showNavigationStatusCheckbox_ = nullptr;

    wxButton* cancelButton_ = nullptr;
    std::vector<wxButton*> sectionSaveButtons_;

    wxWindow* generalPage_ = nullptr;
    wxWindow* soundsPage_ = nullptr;
    wxWindow* chatPage_ = nullptr;
};
}
