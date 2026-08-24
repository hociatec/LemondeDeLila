#include "modules/options/presentation/OptionsView.h"

namespace
{
constexpr int SectionMenuMinWidth = 220;
}

namespace lila::modules::options::presentation
{
OptionsView::OptionsView(wxWindow* parent)
    : wxPanel(parent)
{
    BuildLayout();
}

OptionsView::ShellControls OptionsView::Shell() noexcept
{
    return {sectionsMenu, sectionBook, sectionsPanel, statusLabel, cancelButton};
}

OptionsView::ShellControls OptionsView::Shell() const noexcept
{
    return {sectionsMenu, sectionBook, sectionsPanel, statusLabel, cancelButton};
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
        soundMenuAmbienceSlider,
        soundTavernAmbienceSlider,
        soundAppLaunchSlider,
        soundNavigateSlider,
        soundSelectSlider,
        soundChatMessagesSlider,
        soundMenuAmbienceValueLabel,
        soundTavernAmbienceValueLabel,
        soundAppLaunchValueLabel,
        soundNavigateValueLabel,
        soundSelectValueLabel,
        soundChatMessagesValueLabel,
        soundsSaveButton};
}

OptionsView::ChatSectionControls OptionsView::ChatControls() const noexcept
{
    return {chatEnabledCheckbox, confirmChatExitCheckbox, chatSaveButton};
}

const std::vector<OptionsView::AudioCueControl>& OptionsView::AudioCueControls() const noexcept
{
    return audioCueControls;
}
}
