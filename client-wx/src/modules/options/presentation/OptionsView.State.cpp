#include "modules/options/presentation/OptionsView.h"

#include <wx/checkbox.h>
#include <wx/slider.h>
#include <wx/stattext.h>

namespace lila::modules::options::presentation
{
wxWindow* OptionsView::GetFirstSectionControl(std::size_t sectionIndex) const
{
    if (sectionIndex == 0)
    {
        return confirmExitCheckbox;
    }

    if (sectionIndex == 1)
    {
        return muteAllCheckbox != nullptr ? static_cast<wxWindow*>(muteAllCheckbox) : soundAmbienceCheckbox;
    }

    return chatEnabledCheckbox;
}

domain::OptionsState OptionsView::ReadState(const domain::OptionsState& baseState) const
{
    domain::OptionsState state = baseState;

    if (restoreSessionCheckbox != nullptr)
    {
        state.restoreSessionOnStartup = restoreSessionCheckbox->GetValue();
    }
    if (showNavigationStatusCheckbox != nullptr)
    {
        state.showNavigationStatus = showNavigationStatusCheckbox->GetValue();
    }
    if (confirmExitCheckbox != nullptr)
    {
        state.confirmExit = confirmExitCheckbox->GetValue();
    }
    if (enableBetaGamesCheckbox != nullptr)
    {
        state.enableBetaGames = enableBetaGamesCheckbox->GetValue();
    }
    if (muteAllCheckbox != nullptr)
    {
        state.muteAll = muteAllCheckbox->GetValue();
    }
    if (soundAmbienceCheckbox != nullptr)
    {
        state.soundAmbience = soundAmbienceCheckbox->GetValue();
    }
    if (soundAppLaunchCheckbox != nullptr)
    {
        state.soundAppLaunch = soundAppLaunchCheckbox->GetValue();
    }
    if (soundNavigateCheckbox != nullptr)
    {
        state.soundNavigate = soundNavigateCheckbox->GetValue();
    }
    if (soundSelectCheckbox != nullptr)
    {
        state.soundSelect = soundSelectCheckbox->GetValue();
    }
    if (soundChatMessagesCheckbox != nullptr)
    {
        state.soundChatMessages = soundChatMessagesCheckbox->GetValue();
    }
    if (soundMenuAmbienceSlider != nullptr)
    {
        state.soundMenuAmbienceVolume = soundMenuAmbienceSlider->GetValue();
    }
    if (soundTavernAmbienceSlider != nullptr)
    {
        state.soundTavernAmbienceVolume = soundTavernAmbienceSlider->GetValue();
    }
    if (soundAppLaunchSlider != nullptr)
    {
        state.soundAppLaunchVolume = soundAppLaunchSlider->GetValue();
    }
    if (soundNavigateSlider != nullptr)
    {
        state.soundNavigateVolume = soundNavigateSlider->GetValue();
    }
    if (soundSelectSlider != nullptr)
    {
        state.soundSelectVolume = soundSelectSlider->GetValue();
    }
    if (soundChatMessagesSlider != nullptr)
    {
        state.soundChatMessagesVolume = soundChatMessagesSlider->GetValue();
    }
    if (chatEnabledCheckbox != nullptr)
    {
        state.chatEnabled = chatEnabledCheckbox->GetValue();
    }
    if (confirmChatExitCheckbox != nullptr)
    {
        state.confirmChatExit = confirmChatExitCheckbox->GetValue();
    }

    return state;
}

void OptionsView::WriteState(const domain::OptionsState& state)
{
    const auto setCheckbox = [](wxCheckBox* checkbox, bool value)
    {
        if (checkbox != nullptr)
        {
            checkbox->SetValue(value);
        }
    };
    const auto setSlider = [](wxSlider* slider, wxStaticText* label, int value, const wxString& prefix)
    {
        if (slider != nullptr)
        {
            slider->SetValue(value);
        }
        if (label != nullptr)
        {
            label->SetLabel(wxString::Format(wxString(L"%s : %d %%"), prefix, value));
        }
    };

    setCheckbox(restoreSessionCheckbox, state.restoreSessionOnStartup);
    setCheckbox(showNavigationStatusCheckbox, state.showNavigationStatus);
    setCheckbox(confirmExitCheckbox, state.confirmExit);
    setCheckbox(enableBetaGamesCheckbox, state.enableBetaGames);
    setCheckbox(muteAllCheckbox, state.muteAll);
    setCheckbox(soundAmbienceCheckbox, state.soundAmbience);
    setCheckbox(soundAppLaunchCheckbox, state.soundAppLaunch);
    setCheckbox(soundNavigateCheckbox, state.soundNavigate);
    setCheckbox(soundSelectCheckbox, state.soundSelect);
    setCheckbox(soundChatMessagesCheckbox, state.soundChatMessages);
    setCheckbox(chatEnabledCheckbox, state.chatEnabled);
    setCheckbox(confirmChatExitCheckbox, state.confirmChatExit);

    setSlider(soundMenuAmbienceSlider, soundMenuAmbienceValueLabel, state.soundMenuAmbienceVolume, wxString(L"Ambiance (menu)"));
    setSlider(soundTavernAmbienceSlider, soundTavernAmbienceValueLabel, state.soundTavernAmbienceVolume, wxString(L"Ambiance (table)"));
    setSlider(soundAppLaunchSlider, soundAppLaunchValueLabel, state.soundAppLaunchVolume, wxString(L"Lancement"));
    setSlider(soundNavigateSlider, soundNavigateValueLabel, state.soundNavigateVolume, wxString(L"Navigation"));
    setSlider(soundSelectSlider, soundSelectValueLabel, state.soundSelectVolume, wxString(L"Sélection"));
    setSlider(soundChatMessagesSlider, soundChatMessagesValueLabel, state.soundChatMessagesVolume, wxString(L"Sons de tchat"));

    UpdateSoundControlInteractivity();
}

void OptionsView::SetUnsavedChanges(bool hasUnsavedChanges)
{
    for (wxButton* button : sectionSaveButtons)
    {
        if (button != nullptr)
        {
            button->Enable(hasUnsavedChanges);
        }
    }

    if (cancelButton != nullptr)
    {
        cancelButton->Enable(hasUnsavedChanges);
    }
}

void OptionsView::UpdateSoundControlInteractivity()
{
    const bool soundsEnabled = soundAmbienceCheckbox != nullptr && soundAmbienceCheckbox->GetValue();
    const bool isMuted = muteAllCheckbox != nullptr && muteAllCheckbox->GetValue();
    const bool canInteract = !isMuted;

    if (soundMenuAmbienceSlider != nullptr)
    {
        soundMenuAmbienceSlider->Enable(canInteract && soundsEnabled);
    }
    if (soundTavernAmbienceSlider != nullptr)
    {
        soundTavernAmbienceSlider->Enable(canInteract && soundsEnabled);
    }
    if (soundAppLaunchSlider != nullptr)
    {
        soundAppLaunchSlider->Enable(canInteract && soundAppLaunchCheckbox != nullptr && soundAppLaunchCheckbox->GetValue());
    }
    if (soundNavigateSlider != nullptr)
    {
        soundNavigateSlider->Enable(canInteract && soundNavigateCheckbox != nullptr && soundNavigateCheckbox->GetValue());
    }
    if (soundSelectSlider != nullptr)
    {
        soundSelectSlider->Enable(canInteract && soundSelectCheckbox != nullptr && soundSelectCheckbox->GetValue());
    }
    if (soundChatMessagesSlider != nullptr)
    {
        soundChatMessagesSlider->Enable(canInteract && soundChatMessagesCheckbox != nullptr && soundChatMessagesCheckbox->GetValue());
    }
}
}
