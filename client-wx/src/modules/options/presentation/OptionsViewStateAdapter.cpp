#include "modules/options/presentation/OptionsViewStateAdapter.h"

#include <wx/checkbox.h>
#include <wx/slider.h>
#include <wx/stattext.h>

#include "modules/options/presentation/OptionsView.h"

namespace lila::modules::options::presentation
{
domain::OptionsState OptionsViewStateAdapter::ReadState(const OptionsView& view, const domain::OptionsState& baseState)
{
    domain::OptionsState state = baseState;
    const auto general = view.GeneralControls();
    const auto audio = view.AudioControls();
    const auto chat = view.ChatControls();

    if (general.confirmExitCheckbox != nullptr)
    {
        state.general.confirmExit = general.confirmExitCheckbox->GetValue();
    }
    if (general.repairBrokenAccentsCheckbox != nullptr)
    {
        state.general.repairBrokenAccents = general.repairBrokenAccentsCheckbox->GetValue();
    }
    if (general.enableBetaGamesCheckbox != nullptr)
    {
        state.general.enableBetaGames = general.enableBetaGamesCheckbox->GetValue();
    }
    if (audio.muteAllCheckbox != nullptr)
    {
        state.audio.muteAll = audio.muteAllCheckbox->GetValue();
    }
    if (audio.soundAmbienceCheckbox != nullptr)
    {
        state.audio.soundAmbience = audio.soundAmbienceCheckbox->GetValue();
    }
    if (audio.soundAppLaunchCheckbox != nullptr)
    {
        state.audio.soundAppLaunch = audio.soundAppLaunchCheckbox->GetValue();
    }
    if (audio.soundNavigateCheckbox != nullptr)
    {
        state.audio.soundNavigate = audio.soundNavigateCheckbox->GetValue();
    }
    if (audio.soundSelectCheckbox != nullptr)
    {
        state.audio.soundSelect = audio.soundSelectCheckbox->GetValue();
    }
    if (audio.soundChatMessagesCheckbox != nullptr)
    {
        state.audio.soundChatMessages = audio.soundChatMessagesCheckbox->GetValue();
    }
    if (audio.soundTableAmbienceCheckbox != nullptr)
    {
        state.audio.soundTableAmbience = audio.soundTableAmbienceCheckbox->GetValue();
    }
    if (audio.soundMenuAmbienceSlider != nullptr)
    {
        state.audio.soundMenuAmbienceVolume = audio.soundMenuAmbienceSlider->GetValue();
    }
    if (audio.soundTavernAmbienceSlider != nullptr)
    {
        state.audio.soundTavernAmbienceVolume = audio.soundTavernAmbienceSlider->GetValue();
    }
    state.audio.soundAmbienceSplit = true;
    if (audio.soundAppLaunchSlider != nullptr)
    {
        state.audio.soundAppLaunchVolume = audio.soundAppLaunchSlider->GetValue();
    }
    if (audio.soundNavigateSlider != nullptr)
    {
        state.audio.soundNavigateVolume = audio.soundNavigateSlider->GetValue();
    }
    if (audio.soundSelectSlider != nullptr)
    {
        state.audio.soundSelectVolume = audio.soundSelectSlider->GetValue();
    }
    if (audio.soundChatMessagesSlider != nullptr)
    {
        state.audio.soundChatMessagesVolume = audio.soundChatMessagesSlider->GetValue();
    }
    if (audio.soundTableAmbienceSlider != nullptr)
    {
        state.audio.soundTableAmbienceVolume = audio.soundTableAmbienceSlider->GetValue();
    }
    state.audio.cues = view.ReadAudioCueDraft();
    if (chat.chatEnabledCheckbox != nullptr)
    {
        state.chat.chatEnabled = chat.chatEnabledCheckbox->GetValue();
    }
    if (chat.confirmChatExitCheckbox != nullptr)
    {
        state.chat.confirmChatExit = chat.confirmChatExitCheckbox->GetValue();
    }

    return state;
}

void OptionsViewStateAdapter::WriteState(OptionsView& view, const domain::OptionsState& state)
{
    const auto general = view.GeneralControls();
    const auto audio = view.AudioControls();
    const auto chat = view.ChatControls();
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
            label->SetLabel(wxString::Format(wxString(L"%s : %d%%"), prefix, value));
        }
    };

    setCheckbox(general.confirmExitCheckbox, state.general.confirmExit);
    setCheckbox(general.repairBrokenAccentsCheckbox, state.general.repairBrokenAccents);
    setCheckbox(general.enableBetaGamesCheckbox, state.general.enableBetaGames);
    setCheckbox(audio.muteAllCheckbox, state.audio.muteAll);
    setCheckbox(audio.soundAmbienceCheckbox, state.audio.soundAmbience);
    setCheckbox(audio.soundAppLaunchCheckbox, state.audio.soundAppLaunch);
    setCheckbox(audio.soundNavigateCheckbox, state.audio.soundNavigate);
    setCheckbox(audio.soundSelectCheckbox, state.audio.soundSelect);
    setCheckbox(audio.soundChatMessagesCheckbox, state.audio.soundChatMessages);
    setCheckbox(audio.soundTableAmbienceCheckbox, state.audio.soundTableAmbience);
    setCheckbox(chat.chatEnabledCheckbox, state.chat.chatEnabled);
    setCheckbox(chat.confirmChatExitCheckbox, state.chat.confirmChatExit);

    setSlider(audio.soundMenuAmbienceSlider, audio.soundMenuAmbienceValueLabel, state.audio.soundMenuAmbienceVolume, wxString(L"Volume menu"));
    setSlider(audio.soundTavernAmbienceSlider, audio.soundTavernAmbienceValueLabel, state.audio.soundTavernAmbienceVolume, wxString(L"Volume taverne"));
    setSlider(audio.soundAppLaunchSlider, audio.soundAppLaunchValueLabel, state.audio.soundAppLaunchVolume, wxString(L"Volume connexion"));
    setSlider(audio.soundNavigateSlider, audio.soundNavigateValueLabel, state.audio.soundNavigateVolume, wxString(L"Volume navigation"));
    setSlider(audio.soundSelectSlider, audio.soundSelectValueLabel, state.audio.soundSelectVolume, wxString(L"Volume sélection"));
    setSlider(audio.soundChatMessagesSlider, audio.soundChatMessagesValueLabel, state.audio.soundChatMessagesVolume, wxString(L"Volume messages"));
    setSlider(
        audio.soundTableAmbienceSlider,
        audio.soundTableAmbienceValueLabel,
        state.audio.soundTableAmbienceVolume,
        wxString(L"Volume ambiances de table"));
    view.WriteAudioCueDraft(state.audio.cues);

    UpdateSoundControlInteractivity(view);
}

void OptionsViewStateAdapter::UpdateSoundControlInteractivity(OptionsView& view)
{
    const auto audio = view.AudioControls();
    const bool soundsEnabled = audio.soundAmbienceCheckbox != nullptr && audio.soundAmbienceCheckbox->GetValue();
    const bool isMuted = audio.muteAllCheckbox != nullptr && audio.muteAllCheckbox->GetValue();
    const bool canInteract = !isMuted;

    if (audio.soundMenuAmbienceSlider != nullptr)
    {
        audio.soundMenuAmbienceSlider->Enable(canInteract && soundsEnabled);
    }
    if (audio.soundTavernAmbienceSlider != nullptr)
    {
        audio.soundTavernAmbienceSlider->Enable(canInteract && soundsEnabled);
    }
    if (audio.soundAppLaunchSlider != nullptr)
    {
        audio.soundAppLaunchSlider->Enable(
            canInteract && audio.soundAppLaunchCheckbox != nullptr && audio.soundAppLaunchCheckbox->GetValue());
    }
    if (audio.soundNavigateSlider != nullptr)
    {
        audio.soundNavigateSlider->Enable(
            canInteract && audio.soundNavigateCheckbox != nullptr && audio.soundNavigateCheckbox->GetValue());
    }
    if (audio.soundSelectSlider != nullptr)
    {
        audio.soundSelectSlider->Enable(
            canInteract && audio.soundSelectCheckbox != nullptr && audio.soundSelectCheckbox->GetValue());
    }
    if (audio.soundChatMessagesSlider != nullptr)
    {
        audio.soundChatMessagesSlider->Enable(
            canInteract && audio.soundChatMessagesCheckbox != nullptr && audio.soundChatMessagesCheckbox->GetValue());
    }
    if (audio.soundTableAmbienceSlider != nullptr)
    {
        audio.soundTableAmbienceSlider->Enable(
            canInteract && audio.soundTableAmbienceCheckbox != nullptr &&
            audio.soundTableAmbienceCheckbox->GetValue());
    }
    if (audio.detailedSoundVolumeSlider != nullptr)
    {
        audio.detailedSoundVolumeSlider->Enable(
            canInteract && audio.detailedSoundEnabledCheckbox != nullptr &&
            audio.detailedSoundEnabledCheckbox->GetValue());
    }
}
}
