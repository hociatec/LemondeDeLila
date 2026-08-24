#pragma once
#include <cstddef>
#include <string>
#include <vector>
#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/panel.h>
#include <wx/simplebook.h>
#include <wx/slider.h>
#include <wx/stattext.h>

#include "modules/options/domain/OptionsState.h"

class wxWindow;

namespace lila::shared::ui::controls { class VerticalMenu; }

namespace lila::modules::options::presentation
{
class OptionsViewPagesBuilder;

class OptionsView final : public wxPanel
{
public:
    struct AudioCueControl final
    {
        std::string key;
        wxCheckBox* enabledCheckbox = nullptr;
        wxSlider* volumeSlider = nullptr;
        wxStaticText* volumeLabel = nullptr;
    };

    struct ShellControls final
    {
        lila::shared::ui::controls::VerticalMenu* sectionsMenu;
        wxSimplebook* sectionBook;
        wxPanel* sectionsPanel;
        wxStaticText* statusLabel;
        wxButton* cancelButton;
    };

    struct GeneralSectionControls final
    {
        wxCheckBox* confirmExitCheckbox;
        wxCheckBox* repairBrokenAccentsCheckbox;
        wxCheckBox* enableBetaGamesCheckbox;
        wxButton* saveButton;
    };

    struct AudioSectionControls final
    {
        wxCheckBox* muteAllCheckbox;
        wxCheckBox* soundAmbienceCheckbox;
        wxCheckBox* soundAppLaunchCheckbox;
        wxCheckBox* soundNavigateCheckbox;
        wxCheckBox* soundSelectCheckbox;
        wxCheckBox* soundChatMessagesCheckbox;
        wxSlider* soundMenuAmbienceSlider;
        wxSlider* soundTavernAmbienceSlider;
        wxSlider* soundAppLaunchSlider;
        wxSlider* soundNavigateSlider;
        wxSlider* soundSelectSlider;
        wxSlider* soundChatMessagesSlider;
        wxStaticText* soundMenuAmbienceValueLabel;
        wxStaticText* soundTavernAmbienceValueLabel;
        wxStaticText* soundAppLaunchValueLabel;
        wxStaticText* soundNavigateValueLabel;
        wxStaticText* soundSelectValueLabel;
        wxStaticText* soundChatMessagesValueLabel;
        wxButton* saveButton;
    };

    struct ChatSectionControls final
    {
        wxCheckBox* chatEnabledCheckbox;
        wxCheckBox* confirmChatExitCheckbox;
        wxButton* saveButton;
    };

    explicit OptionsView(wxWindow* parent);
    void ApplyTheme();
    [[nodiscard]] wxWindow* GetFirstSectionControl(std::size_t sectionIndex) const;
    [[nodiscard]] domain::OptionsState ReadState(const domain::OptionsState& baseState) const;
    void WriteState(const domain::OptionsState& state);
    void SetUnsavedChanges(bool hasUnsavedChanges);
    void UpdateSoundControlInteractivity();
    [[nodiscard]] ShellControls Shell() noexcept;
    [[nodiscard]] ShellControls Shell() const noexcept;
    [[nodiscard]] GeneralSectionControls GeneralControls() const noexcept;
    [[nodiscard]] AudioSectionControls AudioControls() const noexcept;
    [[nodiscard]] ChatSectionControls ChatControls() const noexcept;
    [[nodiscard]] const std::vector<AudioCueControl>& AudioCueControls() const noexcept;

private:
    void BuildLayout();
    void BuildSectionMenu(wxWindow* parent);
    void BuildSectionPages(wxWindow* parent);
    void BuildGeneralPage(wxWindow* parent);
    void BuildSoundsPage(wxWindow* parent);
    void BuildChatPage(wxWindow* parent);

    lila::shared::ui::controls::VerticalMenu* sectionsMenu = nullptr;
    wxSimplebook* sectionBook = nullptr;
    wxPanel* sectionsPanel = nullptr;
    wxStaticText* statusLabel = nullptr;

    wxCheckBox* confirmExitCheckbox = nullptr;
    wxCheckBox* repairBrokenAccentsCheckbox = nullptr;
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
    std::vector<AudioCueControl> audioCueControls;

    wxCheckBox* chatEnabledCheckbox = nullptr;
    wxCheckBox* confirmChatExitCheckbox = nullptr;
    wxButton* generalSaveButton = nullptr;
    wxButton* soundsSaveButton = nullptr;
    wxButton* chatSaveButton = nullptr;
    wxButton* cancelButton = nullptr;

    wxWindow* generalPage = nullptr;
    wxWindow* soundsPage = nullptr;
    wxWindow* chatPage = nullptr;

    friend class OptionsViewPagesBuilder;
};
}
