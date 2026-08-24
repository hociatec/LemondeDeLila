#include "modules/options/presentation/OptionsViewPagesBuilder.h"

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/event.h>
#include <wx/gbsizer.h>
#include <wx/sizer.h>
#include <wx/slider.h>
#include <wx/statbox.h>
#include <wx/stattext.h>

#include "modules/options/presentation/OptionsView.h"
#include "shared/accessibility/AccessibilityUtils.h"

namespace lila::modules::options::presentation
{
void OptionsViewPagesBuilder::BuildGeneralPage(OptionsView& view, wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);

    view.confirmExitCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Demander confirmation a la deconnexion"));
    view.restoreSessionCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Restaurer la session au demarrage"));
    view.showNavigationStatusCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Annoncer l'etat de navigation"));
    view.enableBetaGamesCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer les fonctionnalites beta"));

    sizer->Add(view.confirmExitCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(view.restoreSessionCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(view.showNavigationStatusCheckbox, 0, wxBOTTOM, 16);
    sizer->Add(view.enableBetaGamesCheckbox, 0);

    parent->SetSizer(sizer);
}

void OptionsViewPagesBuilder::BuildSoundsPage(OptionsView& view, wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    auto* soundBox = new wxStaticBoxSizer(new wxStaticBox(parent, wxID_ANY, wxString(L"Sons")), wxVERTICAL);

    view.muteAllCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Couper tous les sons"));
    view.soundAmbienceCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons d'ambiance"));
    view.soundAppLaunchCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons au lancement"));
    view.soundNavigateCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de navigation"));
    view.soundSelectCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de selection"));
    view.soundChatMessagesCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons des messages de tchat"));

    view.soundMenuAmbienceSlider = new wxSlider(parent, wxID_ANY, 25, 0, 100);
    view.soundTavernAmbienceSlider = new wxSlider(parent, wxID_ANY, 25, 0, 100);
    view.soundAppLaunchSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    view.soundNavigateSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    view.soundSelectSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);
    view.soundChatMessagesSlider = new wxSlider(parent, wxID_ANY, 50, 0, 100);

    view.soundMenuAmbienceValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Ambiance (menu) : 25 %"));
    view.soundTavernAmbienceValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Ambiance (table) : 25 %"));
    view.soundAppLaunchValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Lancement : 50 %"));
    view.soundNavigateValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Navigation : 50 %"));
    view.soundSelectValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Selection : 50 %"));
    view.soundChatMessagesValueLabel = new wxStaticText(parent, wxID_ANY, wxString(L"Messages : 50 %"));

    soundBox->Add(view.muteAllCheckbox, 0, wxBOTTOM, 12);
    soundBox->Add(view.soundAmbienceCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(view.soundAppLaunchCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(view.soundNavigateCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(view.soundSelectCheckbox, 0, wxBOTTOM, 10);
    soundBox->Add(view.soundChatMessagesCheckbox, 0, wxBOTTOM, 12);

    const auto addSliderRow = [parent](wxGridBagSizer* grid, wxSlider* slider, wxStaticText* label, const wxString& prefix, int row)
    {
        auto* checkRow = new wxStaticText(parent, wxID_ANY, prefix);
        grid->Add(checkRow, wxGBPosition(row, 0), wxGBSpan(1, 1), wxALIGN_CENTER_VERTICAL | wxRIGHT, 10);
        grid->Add(slider, wxGBPosition(row, 1), wxGBSpan(1, 1), wxEXPAND);
        grid->Add(label, wxGBPosition(row, 2), wxGBSpan(1, 1), wxALIGN_CENTER_VERTICAL | wxLEFT, 10);
        label->SetLabel(wxString::Format(wxString(L"%s : %d %%"), prefix, slider->GetValue()));
    };

    auto* soundGrid = new wxGridBagSizer(10, 10);
    addSliderRow(soundGrid, view.soundMenuAmbienceSlider, view.soundMenuAmbienceValueLabel, wxString(L"Ambiance (menu)"), 0);
    addSliderRow(soundGrid, view.soundTavernAmbienceSlider, view.soundTavernAmbienceValueLabel, wxString(L"Ambiance (table)"), 1);
    addSliderRow(soundGrid, view.soundAppLaunchSlider, view.soundAppLaunchValueLabel, wxString(L"Lancement"), 2);
    addSliderRow(soundGrid, view.soundNavigateSlider, view.soundNavigateValueLabel, wxString(L"Navigation"), 3);
    addSliderRow(soundGrid, view.soundSelectSlider, view.soundSelectValueLabel, wxString(L"Selection"), 4);
    addSliderRow(soundGrid, view.soundChatMessagesSlider, view.soundChatMessagesValueLabel, wxString(L"Sons de tchat"), 5);
    soundGrid->AddGrowableCol(1, 1);

    soundBox->Add(soundGrid, 1, wxEXPAND);
    sizer->Add(soundBox, 1, wxEXPAND);
    parent->SetSizer(sizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundMenuAmbienceSlider, wxString(L"Volume ambiance menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundTavernAmbienceSlider, wxString(L"Volume ambiance table"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundAppLaunchSlider, wxString(L"Volume sons de lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundNavigateSlider, wxString(L"Volume sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundSelectSlider, wxString(L"Volume sons de selection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundChatMessagesSlider, wxString(L"Volume sons de tchat"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundMenuAmbienceValueLabel, wxString(L"Valeur actuelle ambiance menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundTavernAmbienceValueLabel, wxString(L"Valeur actuelle ambiance table"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundAppLaunchValueLabel, wxString(L"Valeur actuelle sons de lancement"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundNavigateValueLabel, wxString(L"Valeur actuelle sons de navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundSelectValueLabel, wxString(L"Valeur actuelle sons de selection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundChatMessagesValueLabel, wxString(L"Valeur actuelle sons de tchat"));
}

void OptionsViewPagesBuilder::BuildChatPage(OptionsView& view, wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    view.chatEnabledCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer le tchat"));
    view.confirmChatExitCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Confirmer la sortie du tchat"));
    sizer->Add(view.chatEnabledCheckbox, 0, wxBOTTOM, 12);
    sizer->Add(view.confirmChatExitCheckbox, 0);
    parent->SetSizer(sizer);

}
}
