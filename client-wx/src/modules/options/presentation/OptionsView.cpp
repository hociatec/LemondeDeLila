#include "modules/options/presentation/OptionsView.h"

namespace lila::modules::options::presentation
{
OptionsView::OptionsView(wxWindow* parent)
    : wxPanel(parent)
{
    BuildLayout();
}

OptionsView::ShellControls OptionsView::Shell() noexcept
{
    return {sectionBook, statusLabel, cancelButton};
}

OptionsView::ShellControls OptionsView::Shell() const noexcept
{
    return {sectionBook, statusLabel, cancelButton};
}

OptionsView::GeneralSectionControls OptionsView::GeneralControls() const noexcept
{
    return {confirmExitCheckbox, repairBrokenAccentsCheckbox, enableBetaGamesCheckbox, generalSaveButton};
}

OptionsView::AudioSectionControls OptionsView::AudioControls() const noexcept
{
    return {
        muteAllCheckbox,
        soundAmbienceCheckbox,
        soundAppLaunchCheckbox,
        soundNavigateCheckbox,
        soundSelectCheckbox,
        soundChatMessagesCheckbox,
        soundTableAmbienceCheckbox,
        soundMenuAmbienceSlider,
        soundTavernAmbienceSlider,
        soundAppLaunchSlider,
        soundNavigateSlider,
        soundSelectSlider,
        soundChatMessagesSlider,
        soundTableAmbienceSlider,
        soundMenuAmbienceValueLabel,
        soundTavernAmbienceValueLabel,
        soundAppLaunchValueLabel,
        soundNavigateValueLabel,
        soundSelectValueLabel,
        soundChatMessagesValueLabel,
        soundTableAmbienceValueLabel,
        detailedSoundChoice,
        detailedSoundEnabledCheckbox,
        detailedSoundVolumeSlider,
        detailedSoundVolumeLabel,
        soundsSaveButton};
}

OptionsView::ChatSectionControls OptionsView::ChatControls() const noexcept
{
    return {chatEnabledCheckbox, confirmChatExitCheckbox, chatSaveButton};
}

void OptionsView::SelectAudioCueEditor(std::size_t index)
{
    if (selectedDetailedSoundIndex < detailedSoundKeys.size())
    {
        domain::SoundCueOptions edited;
        if (detailedSoundEnabledCheckbox != nullptr)
        {
            edited.enabled = detailedSoundEnabledCheckbox->GetValue();
        }
        if (detailedSoundVolumeSlider != nullptr)
        {
            edited.volume = detailedSoundVolumeSlider->GetValue();
        }
        const auto& key = detailedSoundKeys[selectedDetailedSoundIndex];
        const auto current = audioCueDraft.find(key);
        const domain::SoundCueOptions previous = current != audioCueDraft.end()
            ? current->second
            : domain::SoundCueOptions{};
        if (edited != previous)
        {
            audioCueDraft[key] = edited;
        }
    }
    if (index >= detailedSoundKeys.size())
    {
        return;
    }

    selectedDetailedSoundIndex = index;
    if (detailedSoundChoice != nullptr && detailedSoundChoice->GetSelection() != static_cast<int>(index))
    {
        detailedSoundChoice->SetSelection(static_cast<int>(index));
    }
    const auto selectedIterator = audioCueDraft.find(detailedSoundKeys[index]);
    const domain::SoundCueOptions selected = selectedIterator != audioCueDraft.end()
        ? selectedIterator->second
        : domain::SoundCueOptions{};
    if (detailedSoundEnabledCheckbox != nullptr)
    {
        detailedSoundEnabledCheckbox->SetValue(selected.enabled);
    }
    if (detailedSoundVolumeSlider != nullptr)
    {
        detailedSoundVolumeSlider->SetValue(selected.volume);
    }
    if (detailedSoundVolumeLabel != nullptr)
    {
        detailedSoundVolumeLabel->SetLabel(
            wxString::Format(wxString(L"Volume individuel : %d%%"), selected.volume));
    }
}

domain::SoundCueOptionsMap OptionsView::ReadAudioCueDraft() const
{
    auto result = audioCueDraft;
    if (selectedDetailedSoundIndex < detailedSoundKeys.size())
    {
        domain::SoundCueOptions edited;
        if (detailedSoundEnabledCheckbox != nullptr)
        {
            edited.enabled = detailedSoundEnabledCheckbox->GetValue();
        }
        if (detailedSoundVolumeSlider != nullptr)
        {
            edited.volume = detailedSoundVolumeSlider->GetValue();
        }
        const auto& key = detailedSoundKeys[selectedDetailedSoundIndex];
        const auto current = result.find(key);
        const domain::SoundCueOptions previous = current != result.end()
            ? current->second
            : domain::SoundCueOptions{};
        if (edited != previous)
        {
            result[key] = edited;
        }
    }
    return result;
}

void OptionsView::WriteAudioCueDraft(const domain::SoundCueOptionsMap& cues)
{
    audioCueDraft = cues;
    selectedDetailedSoundIndex = detailedSoundChoice != nullptr && detailedSoundChoice->GetSelection() >= 0
        ? static_cast<std::size_t>(detailedSoundChoice->GetSelection())
        : 0;
    if (selectedDetailedSoundIndex >= detailedSoundKeys.size())
    {
        selectedDetailedSoundIndex = 0;
    }
    if (!detailedSoundKeys.empty())
    {
        const auto selectedIterator = audioCueDraft.find(detailedSoundKeys[selectedDetailedSoundIndex]);
        const domain::SoundCueOptions selected = selectedIterator != audioCueDraft.end()
            ? selectedIterator->second
            : domain::SoundCueOptions{};
        if (detailedSoundChoice != nullptr)
        {
            detailedSoundChoice->SetSelection(static_cast<int>(selectedDetailedSoundIndex));
        }
        if (detailedSoundEnabledCheckbox != nullptr)
        {
            detailedSoundEnabledCheckbox->SetValue(selected.enabled);
        }
        if (detailedSoundVolumeSlider != nullptr)
        {
            detailedSoundVolumeSlider->SetValue(selected.volume);
        }
        if (detailedSoundVolumeLabel != nullptr)
        {
            detailedSoundVolumeLabel->SetLabel(
                wxString::Format(wxString(L"Volume individuel : %d%%"), selected.volume));
        }
    }
}
}
