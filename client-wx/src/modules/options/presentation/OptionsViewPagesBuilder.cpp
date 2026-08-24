#include "modules/options/presentation/OptionsViewPagesBuilder.h"

#include <wx/button.h>
#include <wx/checkbox.h>
#include <wx/choice.h>
#include <wx/font.h>
#include <wx/scrolwin.h>
#include <wx/sizer.h>
#include <wx/slider.h>
#include <wx/statline.h>
#include <wx/stattext.h>

#include "modules/options/presentation/OptionsView.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "modules/audio/domain/SoundCatalog.h"
#include "modules/audio/presentation/SoundOptionsCatalog.h"

namespace lila::modules::options::presentation
{
namespace
{
void AddPageHeader(wxWindow* parent, wxBoxSizer* sizer, const wxString& title, const wxString& description)
{
    auto* titleLabel = new wxStaticText(parent, wxID_ANY, title);
    wxFont font = titleLabel->GetFont();
    font.SetPointSize(22);
    font.SetWeight(wxFONTWEIGHT_BOLD);
    titleLabel->SetFont(font);
    auto* descriptionLabel = new wxStaticText(parent, wxID_ANY, description);
    sizer->Add(titleLabel, 0, wxBOTTOM, 4);
    sizer->Add(descriptionLabel, 0, wxBOTTOM, 22);
}

void AddSaveButton(wxWindow* parent, wxBoxSizer* sizer, wxButton*& button)
{
    button = new wxButton(parent, wxID_ANY, wxString(L"Enregistrer"));
    button->SetMinSize(wxSize(140, -1));
    sizer->AddStretchSpacer(1);
    sizer->Add(button, 0, wxALIGN_RIGHT | wxTOP, 12);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*button, wxString(L"Enregistrer"));
}

void AddVolumeControl(
    wxWindow* parent,
    wxBoxSizer* sizer,
    wxStaticText*& label,
    wxSlider*& slider,
    const wxString& text,
    int initialValue)
{
    label = new wxStaticText(parent, wxID_ANY, wxString::Format(wxString(L"%s : %d%%"), text, initialValue));
    slider = new wxSlider(parent, wxID_ANY, initialValue, 0, 100);
    sizer->Add(label, 0, wxTOP | wxBOTTOM, 5);
    sizer->Add(slider, 0, wxEXPAND | wxBOTTOM, 9);
}

void FinishScrollablePage(wxWindow* parent, wxSizer* sizer)
{
    parent->SetSizer(sizer);
    if (auto* scrolled = dynamic_cast<wxScrolledWindow*>(parent))
    {
        scrolled->FitInside();
    }
}
}

void OptionsViewPagesBuilder::BuildGeneralPage(OptionsView& view, wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    AddPageHeader(parent, sizer, wxString(L"Général"), wxString(L"Comportement général du client."));

    view.confirmExitCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Demander confirmation à la fermeture"));
    view.repairBrokenAccentsCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Corriger automatiquement les accents cassés (expérimental)"));
    view.enableBetaGamesCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer les jeux en bêta (instable)"));

    sizer->Add(view.confirmExitCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(view.repairBrokenAccentsCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(view.enableBetaGamesCheckbox, 0);
    AddSaveButton(parent, sizer, view.generalSaveButton);
    FinishScrollablePage(parent, sizer);
}

void OptionsViewPagesBuilder::BuildSoundsPage(OptionsView& view, wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    AddPageHeader(parent, sizer, wxString(L"Sons"), wxString(L"Volumes et activation des sons du client."));

    view.muteAllCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Désactiver tous les sons"));
    view.soundAmbienceCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Ambiance (menu et taverne)"));
    view.soundAppLaunchCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de connexion (ouverture / connexion / déconnexion)"));
    view.soundNavigateCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de navigation"));
    view.soundSelectCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons de sélection (invitations / tables)"));
    view.soundChatMessagesCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Sons des messages (tchat et privés)"));

    view.soundTableAmbienceCheckbox = new wxCheckBox(
        parent,
        wxID_ANY,
        wxString(L"Ambiances sonores des tables"));

    sizer->Add(view.muteAllCheckbox, 0, wxBOTTOM, 10);
    sizer->Add(new wxStaticLine(parent), 0, wxEXPAND | wxBOTTOM, 9);
    sizer->Add(view.soundAmbienceCheckbox, 0);
    AddVolumeControl(parent, sizer, view.soundMenuAmbienceValueLabel, view.soundMenuAmbienceSlider, wxString(L"Volume menu"), 25);
    AddVolumeControl(parent, sizer, view.soundTavernAmbienceValueLabel, view.soundTavernAmbienceSlider, wxString(L"Volume taverne"), 25);

    sizer->Add(new wxStaticLine(parent), 0, wxEXPAND | wxTOP | wxBOTTOM, 8);
    sizer->Add(view.soundAppLaunchCheckbox, 0);
    AddVolumeControl(parent, sizer, view.soundAppLaunchValueLabel, view.soundAppLaunchSlider, wxString(L"Volume connexion"), 50);
    sizer->Add(view.soundNavigateCheckbox, 0);
    AddVolumeControl(parent, sizer, view.soundNavigateValueLabel, view.soundNavigateSlider, wxString(L"Volume navigation"), 50);
    sizer->Add(view.soundSelectCheckbox, 0);
    AddVolumeControl(parent, sizer, view.soundSelectValueLabel, view.soundSelectSlider, wxString(L"Volume sélection"), 50);
    sizer->Add(view.soundChatMessagesCheckbox, 0);
    AddVolumeControl(parent, sizer, view.soundChatMessagesValueLabel, view.soundChatMessagesSlider, wxString(L"Volume messages"), 50);
    sizer->Add(view.soundTableAmbienceCheckbox, 0);
    AddVolumeControl(
        parent,
        sizer,
        view.soundTableAmbienceValueLabel,
        view.soundTableAmbienceSlider,
        wxString(L"Volume ambiances de table"),
        15);

    auto* detailTitle = new wxStaticText(parent, wxID_ANY, wxString(L"Réglages détaillés par son"));
    wxFont detailFont = detailTitle->GetFont();
    detailFont.SetPointSize(18);
    detailFont.SetWeight(wxFONTWEIGHT_BOLD);
    detailTitle->SetFont(detailFont);
    sizer->Add(new wxStaticLine(parent), 0, wxEXPAND | wxTOP | wxBOTTOM, 12);
    sizer->Add(detailTitle, 0, wxBOTTOM, 4);
    sizer->Add(
        new wxStaticText(parent, wxID_ANY, wxString(L"Le volume individuel est appliqué après le volume de sa catégorie.")),
        0,
        wxBOTTOM,
        12);

    view.detailedSoundChoice = new wxChoice(parent, wxID_ANY);
    view.detailedSoundKeys.clear();
    for (const auto& option : lila::modules::audio::presentation::GetSoundOptions())
    {
        const auto* descriptor = lila::modules::audio::domain::FindSoundDescriptor(option.cue);
        if (descriptor == nullptr)
        {
            continue;
        }
        const auto groupText = lila::modules::audio::presentation::GetSoundFamilyLabel(descriptor->family);
        const wxString group(groupText.data(), groupText.size());
        const wxString label(option.label.data(), option.label.size());
        view.detailedSoundChoice->Append(wxString::Format(wxString(L"%s — %s"), group, label));
        view.detailedSoundKeys.emplace_back(descriptor->key);
    }
    view.detailedSoundChoice->SetSelection(0);
    view.detailedSoundEnabledCheckbox = new wxCheckBox(
        parent,
        wxID_ANY,
        wxString(L"Activer ce son"));
    view.detailedSoundVolumeLabel = new wxStaticText(
        parent,
        wxID_ANY,
        wxString(L"Volume individuel : 100%"));
    view.detailedSoundVolumeSlider = new wxSlider(parent, wxID_ANY, 100, 0, 100);
    sizer->Add(new wxStaticText(parent, wxID_ANY, wxString(L"Type de son")), 0, wxBOTTOM, 4);
    sizer->Add(view.detailedSoundChoice, 0, wxEXPAND | wxBOTTOM, 8);
    sizer->Add(view.detailedSoundEnabledCheckbox, 0, wxBOTTOM, 4);
    sizer->Add(view.detailedSoundVolumeLabel, 0, wxBOTTOM, 4);
    sizer->Add(view.detailedSoundVolumeSlider, 0, wxEXPAND | wxBOTTOM, 8);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *view.detailedSoundChoice,
        wxString(L"Type de son à configurer"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *view.detailedSoundVolumeSlider,
        wxString(L"Volume individuel du son sélectionné"));

    AddSaveButton(parent, sizer, view.soundsSaveButton);
    FinishScrollablePage(parent, sizer);

    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundMenuAmbienceSlider, wxString(L"Volume menu"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundTavernAmbienceSlider, wxString(L"Volume taverne"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundAppLaunchSlider, wxString(L"Volume connexion"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundNavigateSlider, wxString(L"Volume navigation"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundSelectSlider, wxString(L"Volume sélection"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(*view.soundChatMessagesSlider, wxString(L"Volume messages"));
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleName(
        *view.soundTableAmbienceSlider,
        wxString(L"Volume ambiances de table"));
}

void OptionsViewPagesBuilder::BuildChatPage(OptionsView& view, wxWindow* parent)
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    AddPageHeader(parent, sizer, wxString(L"Tchat"), wxString(L"Activation et fermeture du tchat."));
    view.chatEnabledCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Activer le tchat global"));
    view.confirmChatExitCheckbox = new wxCheckBox(parent, wxID_ANY, wxString(L"Demander confirmation avant de fermer le tchat"));
    sizer->Add(view.chatEnabledCheckbox, 0, wxBOTTOM, 12);
    sizer->Add(view.confirmChatExitCheckbox, 0);
    AddSaveButton(parent, sizer, view.chatSaveButton);
    FinishScrollablePage(parent, sizer);
}
}
