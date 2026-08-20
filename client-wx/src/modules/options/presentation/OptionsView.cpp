#include "modules/options/presentation/OptionsView.h"

#include <utility>

namespace
{
constexpr int SectionMenuMinWidth = 220;
}

namespace lila::modules::options::presentation
{
OptionsView::OptionsView(wxWindow* parent, SaveRequestedHandler onSave)
    : wxPanel(parent),
      onSave_(std::move(onSave))
{
    BuildLayout();
}

OptionsView::ShellControls OptionsView::Shell() noexcept
{
    return {sectionsMenu, sectionBook, sectionsPanel, statusLabel, cancelButton, &sectionSaveButtons};
}

OptionsView::ShellControls OptionsView::Shell() const noexcept
{
    return {sectionsMenu, sectionBook, sectionsPanel, statusLabel, cancelButton, const_cast<std::vector<wxButton*>*>(&sectionSaveButtons)};
}

OptionsView::GeneralSectionControls OptionsView::GeneralControls() const noexcept
{
    return {confirmExitCheckbox, enableBetaGamesCheckbox, restoreSessionCheckbox, showNavigationStatusCheckbox};
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
        soundChatMessagesValueLabel};
}

OptionsView::ChatSectionControls OptionsView::ChatControls() const noexcept
{
    return {chatEnabledCheckbox, confirmChatExitCheckbox};
}
}
