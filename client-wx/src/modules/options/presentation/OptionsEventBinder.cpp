#include "modules/options/presentation/OptionsEventBinder.h"

#include <utility>

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/event.h>
#include <wx/msgdlg.h>
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
        label.SetLabel(wxString::Format(wxString(L"%s : %d%%"), prefix, slider.GetValue()));
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
    wxWindow& owner,
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
        shell.sectionsMenu->SetSelectionChangedHandler(
            [selectSection = handlers.selectSection](std::size_t index)
            {
                if (selectSection)
                {
                    selectSection(index);
                }
            });
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

    const auto& changed = handlers.stateChanged;
    BindCheckbox(general.confirmExitCheckbox, false, view, focusController, changed);
    BindCheckbox(general.repairBrokenAccentsCheckbox, false, view, focusController, changed);
    if (general.enableBetaGamesCheckbox != nullptr)
    {
        general.enableBetaGamesCheckbox->Bind(
            wxEVT_CHECKBOX,
            [&owner, checkbox = general.enableBetaGamesCheckbox, changed](wxCommandEvent&)
            {
                if (checkbox->GetValue())
                {
                    const int answer = wxMessageBox(
                        wxString(L"Les jeux en bêta peuvent être instables. Voulez-vous vraiment les activer ?"),
                        wxString(L"Mode bêta"),
                        wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
                        &owner);
                    if (answer != wxYES)
                    {
                        checkbox->SetValue(false);
                    }
                }
                if (changed)
                {
                    changed();
                }
            });
    }
    BindCheckbox(audio.muteAllCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundAmbienceCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundAppLaunchCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundNavigateCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundSelectCheckbox, true, view, focusController, changed);
    BindCheckbox(audio.soundChatMessagesCheckbox, true, view, focusController, changed);
    for (const auto& control : view.AudioCueControls())
    {
        BindCheckbox(control.enabledCheckbox, true, view, focusController, changed);
    }
    BindCheckbox(chat.chatEnabledCheckbox, false, view, focusController, changed);
    BindCheckbox(chat.confirmChatExitCheckbox, false, view, focusController, changed);

    const auto bindSliderIfReady = [&changed](wxSlider* slider, wxStaticText* label, const wxString& prefix)
    {
        if (slider != nullptr && label != nullptr)
        {
            BindSlider(*slider, *label, prefix, changed);
        }
    };
    bindSliderIfReady(audio.soundMenuAmbienceSlider, audio.soundMenuAmbienceValueLabel, wxString(L"Volume menu"));
    bindSliderIfReady(audio.soundTavernAmbienceSlider, audio.soundTavernAmbienceValueLabel, wxString(L"Volume taverne"));
    bindSliderIfReady(audio.soundAppLaunchSlider, audio.soundAppLaunchValueLabel, wxString(L"Volume connexion"));
    bindSliderIfReady(audio.soundNavigateSlider, audio.soundNavigateValueLabel, wxString(L"Volume navigation"));
    bindSliderIfReady(audio.soundSelectSlider, audio.soundSelectValueLabel, wxString(L"Volume sélection"));
    bindSliderIfReady(audio.soundChatMessagesSlider, audio.soundChatMessagesValueLabel, wxString(L"Volume messages"));
    for (const auto& control : view.AudioCueControls())
    {
        bindSliderIfReady(control.volumeSlider, control.volumeLabel, wxString(L"Volume individuel"));
    }

    for (wxButton* saveButton : {general.saveButton, audio.saveButton, chat.saveButton})
    {
        if (saveButton != nullptr)
        {
            saveButton->Bind(
                wxEVT_BUTTON,
                [saveState = handlers.saveState](wxCommandEvent&)
                {
                    if (saveState)
                    {
                        saveState();
                    }
                });
        }
    }

    lila::shared::accessibility::NavigationController::BindEscapeNavigation(
        owner,
        [handlers]()
        {
            if (handlers.handleEscape)
            {
                handlers.handleEscape();
            }
            return true;
        });

    focusController.BindNavigation(owner, handlers.isInsideSection);
}
}
