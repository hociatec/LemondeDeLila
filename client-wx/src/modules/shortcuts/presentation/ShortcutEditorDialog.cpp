#include "modules/shortcuts/presentation/ShortcutEditorDialog.h"
#include <algorithm>
#include "modules/shortcuts/presentation/ShortcutKeys.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include <wx/textctrl.h>
#include <wx/listbox.h>
#include <wx/checkbox.h>
#include <wx/stattext.h>
#include <wx/button.h>
#include <wx/sizer.h>

namespace lila::modules::shortcuts::presentation
{
using lila::shared::text::FromUtf8;
using lila::shared::text::ToUtf8;
ShortcutEditorDialog::ShortcutEditorDialog(wxWindow* parent, std::vector<domain::ShortcutTarget> targets,
    const domain::Shortcut& initial, std::vector<domain::Shortcut> others)
    : wxDialog(parent, wxID_ANY, L"Configurer un raccourci", wxDefaultPosition, wxSize(660, 560),
        wxDEFAULT_DIALOG_STYLE | wxRESIZE_BORDER),
      targets_(std::move(targets)), others_(std::move(others)), selectedTarget_(initial.target)
{
    if (!initial.target.empty() && std::none_of(targets_.begin(), targets_.end(),
        [&](const auto& target) { return target.id == initial.target; }))
        targets_.push_back({initial.target, initial.label + " (indisponible actuellement)"});
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    sizer->Add(new wxStaticText(this, wxID_ANY, L"Rechercher un jeu ou une fonctionnalité"), 0, wxALL, 8);
    search_ = new wxTextCtrl(this, wxID_ANY);
    sizer->Add(search_, 0, wxEXPAND | wxALL, 8);
    destinations_ = new wxListBox(this, wxID_ANY);
    sizer->Add(destinations_, 1, wxEXPAND | wxALL, 8);
    sizer->Add(new wxStaticText(this, wxID_ANY, L"Nom du raccourci"), 0, wxLEFT, 8);
    label_ = new wxTextCtrl(this, wxID_ANY, FromUtf8(initial.label));
    label_->SetMaxLength(120);
    sizer->Add(label_, 0, wxEXPAND | wxALL, 8);
    sizer->Add(new wxStaticText(this, wxID_ANY,
        L"Combinaison : appuyez sur Ctrl+Maj ou Alt+Maj avec une lettre, un chiffre ou F1 à F12"), 0, wxLEFT, 8);
    chord_ = new wxTextCtrl(this, wxID_ANY, FromUtf8(initial.chord), wxDefaultPosition, wxDefaultSize, wxTE_READONLY);
    sizer->Add(chord_, 0, wxEXPAND | wxALL, 8);
    enabled_ = new wxCheckBox(this, wxID_ANY, L"Raccourci activé");
    enabled_->SetValue(initial.enabled);
    sizer->Add(enabled_, 0, wxALL, 8);
    status_ = new wxStaticText(this, wxID_ANY, L"Choisissez une combinaison libre dans votre lecteur d'écran et votre système.");
    sizer->Add(status_, 0, wxEXPAND | wxALL, 8);
    sizer->Add(CreateButtonSizer(wxOK | wxCANCEL), 0, wxEXPAND | wxALL, 8);
    SetSizer(sizer);
    using A = lila::shared::accessibility::AccessibilityUtils;
    A::SetAccessibleName(*search_, L"Rechercher une destination");
    A::SetAccessibleName(*destinations_, L"Jeux et fonctionnalités");
    A::SetAccessibleName(*label_, L"Nom du raccourci");
    A::SetAccessibleName(*chord_, L"Combinaison de touches. Appuyez sur la combinaison souhaitée.");
    search_->Bind(wxEVT_TEXT, [this](wxCommandEvent&) { FilterTargets(); });
    destinations_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent&)
    {
        const int index = destinations_->GetSelection();
        if (index < 0) return;
        const auto& target = targets_[filtered_[static_cast<std::size_t>(index)]];
        selectedTarget_ = target.id;
        label_->ChangeValue(FromUtf8(target.label));
    });
    chord_->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& event)
    {
        if (event.GetKeyCode() == WXK_TAB || event.GetKeyCode() == WXK_ESCAPE) { event.Skip(); return; }
        const auto chord = ShortcutChord(event);
        if (chord.empty()) { event.Skip(); return; }
        chord_->ChangeValue(FromUtf8(chord));
        const auto text = domain::ValidChord(chord) ? FromUtf8(chord) : wxString(L"Cette combinaison est réservée.");
        status_->SetLabel(text);
        A::SetAccessibleStatus(*status_, text);
        A::AnnounceStatus(*status_, text);
    });
    Bind(wxEVT_BUTTON, [this](wxCommandEvent&) { Accept(); }, wxID_OK);
    FilterTargets();
    CentreOnParent();
    lila::shared::accessibility::NavigationController::Focus(search_);
}
void ShortcutEditorDialog::FilterTargets()
{
    destinations_->Clear();
    filtered_.clear();
    const auto query = search_->GetValue().Lower();
    for (std::size_t index = 0; index < targets_.size(); ++index)
    {
        const auto label = FromUtf8(targets_[index].label);
        if (!query.empty() && !label.Lower().Contains(query)) continue;
        destinations_->Append(label);
        filtered_.push_back(index);
        if (targets_[index].id == selectedTarget_) destinations_->SetSelection(static_cast<int>(filtered_.size() - 1));
    }
}
domain::Shortcut ShortcutEditorDialog::Result() const
{
    auto label = label_->GetValue(); label.Trim().Trim(false);
    return {selectedTarget_, ToUtf8(label), ToUtf8(chord_->GetValue()), enabled_->GetValue()};
}
void ShortcutEditorDialog::Accept()
{
    auto items = others_;
    items.push_back(Result());
    const auto error = domain::Validate(items);
    if (!error.empty())
    {
        status_->SetLabel(FromUtf8(error));
        lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*status_, FromUtf8(error));
        Layout();
        return;
    }
    EndModal(wxID_OK);
}
}
