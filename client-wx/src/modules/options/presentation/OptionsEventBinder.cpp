#include "modules/options/presentation/OptionsEventBinder.h"

#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/event.h>
#include <wx/frame.h>
#include <wx/slider.h>
#include <wx/stattext.h>
#include <wx/window.h>

#include "modules/options/presentation/OptionsFocusController.h"
#include "modules/options/presentation/OptionsView.h"
#include "shared/accessibility/NavigationController.h"
#include "shared/ui/controls/VerticalMenu.h"

namespace lila::modules::options::presentation
{
namespace
{
void BindSlider(
    wxSlider& slider,
    wxStaticText& label,
    const wxString& prefix,
    const std::function<void()>& onChanged)
{
    const auto updateLabel = [&slider, &label, prefix]()
    {
        label.SetLabel(wxString::Format(wxString(L"%s : %d %%"), prefix, slider.GetValue()));
    };

    updateLabel();
    slider.Bind(
        wxEVT_SLIDER,
        [updateLabel, onChanged](wxCommandEvent&)
        {
            updateLabel();
            if (onChanged)
            {
                onChanged();
            }
        });
}

void BindCheckbox(
    wxCheckBox* checkbox,
    bool updateSoundInteractivity,
    OptionsView& view,
    OptionsFocusController& focusController,
    const std::function<void()>& onChanged)
{
    if (checkbox == nullptr)
    {
        return;
    }

    checkbox->Bind(
        wxEVT_CHECKBOX,
        [&view, &focusController, updateSoundInteractivity, onChanged](wxCommandEvent&)
        {
            if (updateSoundInteractivity)
            {
                view.UpdateSoundControlInteractivity();
                wxWindow* focused = wxWindow::FindFocus();
                if (focused != nullptr && !focused->IsEnabled())
                {
                    static_cast<void>(focusController.FocusNextSectionControl());
                }
            }

            if (onChanged)
            {
                onChanged();
            }
        });
}
}

void OptionsEventBinder::Bind(
    wxFrame& frame,
    OptionsView& view,
    OptionsFocusController& focusController,
    Handlers handlers)
{
    const auto shell = view.Shell();
    const auto general = view.GeneralControls();
    const auto audio = view.AudioControls();
    const auto chat = view.ChatControls();

    if (shell.sectionsMenu != nullptr)
    {
        shell.sectionsMenu->SetSelectionChangedHandler([](std::size_t) {});
        shell.sectionsMenu->SetActivatedHandler(
            [activateSection = handlers.activateSection](std::size_t index)
            {
                if (activateSection)
                {
                    activateSection(index);
                }
            });
    }

    if (shell.cancelButton != nullptr)
    {
        shell.cancelButton->Bind(
            wxEVT_BUTTON,
            [cancelChanges = handlers.cancelChanges](wxCommandEvent&)
            {
                if (cancelChanges)
                {
                    cancelChanges();
                }
            });
    }

    const auto& changed = handlers.refreshUnsavedState;
    BindCheckbox(general.restoreSessionCheckbox, false, view, focusController, changed);
    BindCheckbox(general.showNavigationStatusCheckbox, false, view, focusController, changed);
    BindCheckbox(general.confirmExitCheckbox, false, view, focusController, changed);
    BindCheckbox(general.enableBetaGamesCheckbox, false, view, focusController, changed);
    BindCheckbox(audio.muteAllCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundAmbienceCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundAppLaunchCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundNavigateCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundSelectCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundChatMessagesCheckbox, true, view, focusController, changed);
    BindCheckbox(chat.chatEnabledCheckbox, false, view, focusController, changed);
    BindCheckbox(chat.confirmChatExitCheckbox, false, view, focusController, changed);

    const auto bindSliderIfReady = [&changed](wxSlider* slider, wxStaticText* label, const wxString& prefix)
    {
        if (slider != nullptr && label != nullptr)
        {
            BindSlider(*slider, *label, prefix, changed);
        }
    };
    bindSliderIfReady(audio.soundMenuAmbienceSlider, audio.soundMenuAmbienceValueLabel, wxString(L"Ambiance (menu)"));
    bindSliderIfReady(audio.soundTavernAmbienceSlider, audio.soundTavernAmbienceValueLabel, wxString(L"Ambiance (taverne)"));
    bindSliderIfReady(audio.soundAppLaunchSlider, audio.soundAppLaunchValueLabel, wxString(L"Lancement de l'application"));
    bindSliderIfReady(audio.soundNavigateSlider, audio.soundNavigateValueLabel, wxString(L"Navigation"));
    bindSliderIfReady(audio.soundSelectSlider, audio.soundSelectValueLabel, wxString(L"Selection"));
    bindSliderIfReady(audio.soundChatMessagesSlider, audio.soundChatMessagesValueLabel, wxString(L"Messages du chat"));

    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        frame,
        [handlers]()
        {
            if (handlers.handleEscape)
            {
                handlers.handleEscape();
            }
            return true;
        });

    focusController.BindNavigation(frame, handlers.isInsideSection);

    frame.Bind(
        wxEVT_CLOSE_WINDOW,
        [onExitRequested = std::move(handlers.onExitRequested)](wxCloseEvent& event)
        {
            if (event.CanVeto())
            {
                event.Veto();
            }
            event.Skip(false);
            if (onExitRequested && event.CanVeto())
            {
                onExitRequested();
            }
        });
}
}
