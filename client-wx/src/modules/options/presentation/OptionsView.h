#pragma once
#include <cstddef>
#include <functional>
#include <vector>
#include <wx/panel.h>

#include "modules/options/domain/OptionsState.h"

class wxBoxSizer;
class wxButton;
class wxCheckBox;
class wxSimplebook;
class wxSlider;
class wxStaticText;
class wxWindow;

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::options::presentation
{
class OptionsView final : public wxPanel
{
public:
    using SaveRequestedHandler = std::function<void()>;

    OptionsView(wxWindow* parent, SaveRequestedHandler onSave);
    void ApplyTheme();
    [[nodiscard]] wxWindow* GetFirstSectionControl(std::size_t sectionIndex) const;
    [[nodiscard]] domain::OptionsState ReadState(const domain::OptionsState& baseState) const;
    void WriteState(const domain::OptionsState& state);
    void SetUnsavedChanges(bool hasUnsavedChanges);
    void UpdateSoundControlInteractivity();

    lila::shared::ui::controls::VerticalMenu* sectionsMenu = nullptr;
    wxSimplebook* sectionBook = nullptr;
    wxPanel* sectionsPanel = nullptr;
    wxStaticText* statusLabel = nullptr;

    wxCheckBox* confirmExitCheckbox = nullptr;
    wxCheckBox* enableBetaGamesCheckbox = nullptr;
    wxCheckBox* muteAllCheckbox = nullptr;
    wxCheckBox* soundAmbienceCheckbox = nullptr;
    wxCheckBox* soundAppLaunchCheckbox = nullptr;
    wxCheckBox* soundNavigateCheckbox = nullptr;
    wxCheckBox* soundSelectCheckbox = nullptr;
    wxCheckBox* soundChatMessagesCheckbox = nullptr;

    wxSlider* soundMenuAmbienceSlider = nullptr;
    wxSlider* soundTavernAmbienceSlider = nullptr;
    wxSlider* soundAppLaunchSlider = nullptr;
    wxSlider* soundNavigateSlider = nullptr;
    wxSlider* soundSelectSlider = nullptr;
    wxSlider* soundChatMessagesSlider = nullptr;

    wxStaticText* soundMenuAmbienceValueLabel = nullptr;
    wxStaticText* soundTavernAmbienceValueLabel = nullptr;
    wxStaticText* soundAppLaunchValueLabel = nullptr;
    wxStaticText* soundNavigateValueLabel = nullptr;
    wxStaticText* soundSelectValueLabel = nullptr;
    wxStaticText* soundChatMessagesValueLabel = nullptr;

    wxCheckBox* chatEnabledCheckbox = nullptr;
    wxCheckBox* confirmChatExitCheckbox = nullptr;
    wxCheckBox* restoreSessionCheckbox = nullptr;
    wxCheckBox* showNavigationStatusCheckbox = nullptr;
    wxButton* cancelButton = nullptr;
    std::vector<wxButton*> sectionSaveButtons;

    wxWindow* generalPage = nullptr;
    wxWindow* soundsPage = nullptr;
    wxWindow* chatPage = nullptr;

private:
    void BuildLayout();
    void BuildSectionMenu(wxWindow* parent);
    void BuildSectionPages(wxWindow* parent);
    void BuildGeneralPage(wxWindow* parent);
    void BuildSoundsPage(wxWindow* parent);
    void BuildChatPage(wxWindow* parent);
    void AddSectionSaveButton(wxWindow* parent, wxBoxSizer* sectionSizer);

    SaveRequestedHandler onSave_;
};
}
