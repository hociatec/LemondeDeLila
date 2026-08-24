#pragma once
#include <cstddef>
#include <string>
#include <vector>
#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/notebook.h>
#include <wx/panel.h>
#include <wx/slider.h>
#include <wx/stattext.h>

#include "modules/options/domain/OptionsState.h"

class wxWindow;

namespace lila::modules::options::presentation
{
class OptionsViewPagesBuilder;

class OptionsView final : public wxPanel
{
public:
    struct ShellControls final
    {
        wxNotebook* sectionBook;
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
        wxCheckBox* soundTableAmbienceCheckbox;
        wxSlider* soundMenuAmbienceSlider;
        wxSlider* soundTavernAmbienceSlider;
        wxSlider* soundAppLaunchSlider;
        wxSlider* soundNavigateSlider;
        wxSlider* soundSelectSlider;
        wxSlider* soundChatMessagesSlider;
        wxSlider* soundTableAmbienceSlider;
        wxStaticText* soundMenuAmbienceValueLabel;
        wxStaticText* soundTavernAmbienceValueLabel;
        wxStaticText* soundAppLaunchValueLabel;
        wxStaticText* soundNavigateValueLabel;
        wxStaticText* soundSelectValueLabel;
        wxStaticText* soundChatMessagesValueLabel;
        wxStaticText* soundTableAmbienceValueLabel;
        wxChoice* detailedSoundChoice;
        wxCheckBox* detailedSoundEnabledCheckbox;
        wxSlider* detailedSoundVolumeSlider;
        wxStaticText* detailedSoundVolumeLabel;
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
    [[nodiscard]] domain::OptionsState ReadState(const domain::OptionsState& baseState) const;
    void WriteState(const domain::OptionsState& state);
    void SetUnsavedChanges(bool hasUnsavedChanges);
    void UpdateSoundControlInteractivity();
    [[nodiscard]] ShellControls Shell() noexcept;
    [[nodiscard]] ShellControls Shell() const noexcept;
    [[nodiscard]] GeneralSectionControls GeneralControls() const noexcept;
    [[nodiscard]] AudioSectionControls AudioControls() const noexcept;
    [[nodiscard]] ChatSectionControls ChatControls() const noexcept;
    void SelectAudioCueEditor(std::size_t index);
    [[nodiscard]] domain::SoundCueOptionsMap ReadAudioCueDraft() const;
    void WriteAudioCueDraft(const domain::SoundCueOptionsMap& cues);

private:
    void BuildLayout();
    void BuildSectionPages(wxWindow* parent);
    void BuildGeneralPage(wxWindow* parent);
    void BuildSoundsPage(wxWindow* parent);
    void BuildChatPage(wxWindow* parent);

    wxNotebook* sectionBook = nullptr;
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
    wxCheckBox* soundTableAmbienceCheckbox = nullptr;

    wxSlider* soundMenuAmbienceSlider = nullptr;
    wxSlider* soundTavernAmbienceSlider = nullptr;
    wxSlider* soundAppLaunchSlider = nullptr;
    wxSlider* soundNavigateSlider = nullptr;
    wxSlider* soundSelectSlider = nullptr;
    wxSlider* soundChatMessagesSlider = nullptr;
    wxSlider* soundTableAmbienceSlider = nullptr;

    wxStaticText* soundMenuAmbienceValueLabel = nullptr;
    wxStaticText* soundTavernAmbienceValueLabel = nullptr;
    wxStaticText* soundAppLaunchValueLabel = nullptr;
    wxStaticText* soundNavigateValueLabel = nullptr;
    wxStaticText* soundSelectValueLabel = nullptr;
    wxStaticText* soundChatMessagesValueLabel = nullptr;
    wxStaticText* soundTableAmbienceValueLabel = nullptr;
    wxChoice* detailedSoundChoice = nullptr;
    wxCheckBox* detailedSoundEnabledCheckbox = nullptr;
    wxSlider* detailedSoundVolumeSlider = nullptr;
    wxStaticText* detailedSoundVolumeLabel = nullptr;
    std::vector<std::string> detailedSoundKeys;
    domain::SoundCueOptionsMap audioCueDraft;
    std::size_t selectedDetailedSoundIndex = 0;

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
