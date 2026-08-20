#include "modules/options/presentation/OptionsViewStateAdapter.h"

#include <wx/checkbox.h>
#include <wx/slider.h>
#include <wx/stattext.h>

#include "modules/options/presentation/OptionsView.h"

namespace lila::modules::options::presentation
{
wxWindow* OptionsViewStateAdapter::GetFirstSectionControl(const OptionsView& view, std::size_t sectionIndex)
{
    const auto general = view.GeneralControls();
    const auto audio = view.AudioControls();
    const auto chat = view.ChatControls();
    if (sectionIndex == 0)
    {
        return general.confirmExitCheckbox;
    }

    if (sectionIndex == 1)
    {
        return audio.muteAllCheckbox != nullptr ? static_cast<wxWindow*>(audio.muteAllCheckbox) : audio.soundAmbienceCheckbox;
    }

    return chat.chatEnabledCheckbox;
}

domain::OptionsState OptionsViewStateAdapter::ReadState(const OptionsView& view, const domain::OptionsState& baseState)
{
    domain::OptionsState state = baseState;
    const auto general = view.GeneralControls();
    const auto audio = view.AudioControls();
    const auto chat = view.ChatControls();

    if (general.restoreSessionCheckbox != nullptr)
    {
        state.restoreSessionOnStartup = general.restoreSessionCheckbox->GetValue();
    }
    if (general.showNavigationStatusCheckbox != nullptr)
    {
        state.showNavigationStatus = general.showNavigationStatusCheckbox->GetValue();
    }
    if (general.confirmExitCheckbox != nullptr)
    {
        state.confirmExit = general.confirmExitCheckbox->GetValue();
    }
    if (general.enableBetaGamesCheckbox != nullptr)
    {
        state.enableBetaGames = general.enableBetaGamesCheckbox->GetValue();
    }
    if (audio.muteAllCheckbox != nullptr)
    {
        state.muteAll = audio.muteAllCheckbox->GetValue();
    }
    if (audio.soundAmbienceCheckbox != nullptr)
    {
        state.soundAmbience = audio.soundAmbienceCheckbox->GetValue();
    }
    if (audio.soundAppLaunchCheckbox != nullptr)
    {
        state.soundAppLaunch = audio.soundAppLaunchCheckbox->GetValue();
    }
    if (audio.soundNavigateCheckbox != nullptr)
    {
        state.soundNavigate = audio.soundNavigateCheckbox->GetValue();
    }
    if (audio.soundSelectCheckbox != nullptr)
    {
        state.soundSelect = audio.soundSelectCheckbox->GetValue();
    }
    if (audio.soundChatMessagesCheckbox != nullptr)
    {
        state.soundChatMessages = audio.soundChatMessagesCheckbox->GetValue();
    }
    if (audio.soundMenuAmbienceSlider != nullptr)
    {
        state.soundMenuAmbienceVolume = audio.soundMenuAmbienceSlider->GetValue();
    }
    if (audio.soundTavernAmbienceSlider != nullptr)
    {
        state.soundTavernAmbienceVolume = audio.soundTavernAmbienceSlider->GetValue();
    }
    if (audio.soundAppLaunchSlider != nullptr)
    {
        state.soundAppLaunchVolume = audio.soundAppLaunchSlider->GetValue();
    }
    if (audio.soundNavigateSlider != nullptr)
    {
        state.soundNavigateVolume = audio.soundNavigateSlider->GetValue();
    }
    if (audio.soundSelectSlider != nullptr)
    {
        state.soundSelectVolume = audio.soundSelectSlider->GetValue();
    }
    if (audio.soundChatMessagesSlider != nullptr)
    {
        state.soundChatMessagesVolume = audio.soundChatMessagesSlider->GetValue();
    }
    if (chat.chatEnabledCheckbox != nullptr)
    {
        state.chatEnabled = chat.chatEnabledCheckbox->GetValue();
    }
    if (chat.confirmChatExitCheckbox != nullptr)
    {
        state.confirmChatExit = chat.confirmChatExitCheckbox->GetValue();
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
            label->SetLabel(wxString::Format(wxString(L"%s : %d %%"), prefix, value));
        }
    };

    setCheckbox(general.restoreSessionCheckbox, state.restoreSessionOnStartup);
    setCheckbox(general.showNavigationStatusCheckbox, state.showNavigationStatus);
    setCheckbox(general.confirmExitCheckbox, state.confirmExit);
    setCheckbox(general.enableBetaGamesCheckbox, state.enableBetaGames);
    setCheckbox(audio.muteAllCheckbox, state.muteAll);
    setCheckbox(audio.soundAmbienceCheckbox, state.soundAmbience);
    setCheckbox(audio.soundAppLaunchCheckbox, state.soundAppLaunch);
    setCheckbox(audio.soundNavigateCheckbox, state.soundNavigate);
    setCheckbox(audio.soundSelectCheckbox, state.soundSelect);
    setCheckbox(audio.soundChatMessagesCheckbox, state.soundChatMessages);
    setCheckbox(chat.chatEnabledCheckbox, state.chatEnabled);
    setCheckbox(chat.confirmChatExitCheckbox, state.confirmChatExit);

    setSlider(audio.soundMenuAmbienceSlider, audio.soundMenuAmbienceValueLabel, state.soundMenuAmbienceVolume, wxString(L"Ambiance (menu)"));
    setSlider(audio.soundTavernAmbienceSlider, audio.soundTavernAmbienceValueLabel, state.soundTavernAmbienceVolume, wxString(L"Ambiance (table)"));
    setSlider(audio.soundAppLaunchSlider, audio.soundAppLaunchValueLabel, state.soundAppLaunchVolume, wxString(L"Lancement"));
    setSlider(audio.soundNavigateSlider, audio.soundNavigateValueLabel, state.soundNavigateVolume, wxString(L"Navigation"));
    setSlider(audio.soundSelectSlider, audio.soundSelectValueLabel, state.soundSelectVolume, wxString(L"Selection"));
    setSlider(audio.soundChatMessagesSlider, audio.soundChatMessagesValueLabel, state.soundChatMessagesVolume, wxString(L"Sons de tchat"));

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
}
}
