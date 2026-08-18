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
    if (view.sectionsMenu != nullptr)
    {
        view.sectionsMenu->SetSelectionChangedHandler([](std::size_t) {});
        view.sectionsMenu->SetActivatedHandler(
            [activateSection = handlers.activateSection](std::size_t index)
            {
                if (activateSection)
                {
                    activateSection(index);
                }
            });
    }

    if (view.cancelButton != nullptr)
    {
        view.cancelButton->Bind(
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
    BindCheckbox(view.restoreSessionCheckbox, false, view, focusController, changed);
    BindCheckbox(view.showNavigationStatusCheckbox, false, view, focusController, changed);
    BindCheckbox(view.confirmExitCheckbox, false, view, focusController, changed);
    BindCheckbox(view.enableBetaGamesCheckbox, false, view, focusController, changed);
    BindCheckbox(view.muteAllCheckbox, true, view, focusController, changed);
    BindCheckbox(view.soundAmbienceCheckbox, true, view, focusController, changed);
    BindCheckbox(view.soundAppLaunchCheckbox, true, view, focusController, changed);
    BindCheckbox(view.soundNavigateCheckbox, true, view, focusController, changed);
    BindCheckbox(view.soundSelectCheckbox, true, view, focusController, changed);
    BindCheckbox(view.soundChatMessagesCheckbox, true, view, focusController, changed);
    BindCheckbox(view.chatEnabledCheckbox, false, view, focusController, changed);
    BindCheckbox(view.confirmChatExitCheckbox, false, view, focusController, changed);

    const auto bindSliderIfReady = [&changed](wxSlider* slider, wxStaticText* label, const wxString& prefix)
    {
        if (slider != nullptr && label != nullptr)
        {
            BindSlider(*slider, *label, prefix, changed);
        }
    };
    bindSliderIfReady(view.soundMenuAmbienceSlider, view.soundMenuAmbienceValueLabel, wxString(L"Ambiance (menu)"));
    bindSliderIfReady(view.soundTavernAmbienceSlider, view.soundTavernAmbienceValueLabel, wxString(L"Ambiance (taverne)"));
    bindSliderIfReady(view.soundAppLaunchSlider, view.soundAppLaunchValueLabel, wxString(L"Lancement de l'application"));
    bindSliderIfReady(view.soundNavigateSlider, view.soundNavigateValueLabel, wxString(L"Navigation"));
    bindSliderIfReady(view.soundSelectSlider, view.soundSelectValueLabel, wxString(L"Sélection"));
    bindSliderIfReady(view.soundChatMessagesSlider, view.soundChatMessagesValueLabel, wxString(L"Messages du chat"));

    frame.Bind(
        wxEVT_CHAR_HOOK,
        [&focusController, handlers](wxKeyEvent& event)
        {
            const int keyCode = event.GetKeyCode();
            if (keyCode == WXK_ESCAPE)
            {
                if (handlers.handleEscape)
                {
                    handlers.handleEscape();
                }
                event.Skip(false);
                return;
            }

            event.Skip();
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
