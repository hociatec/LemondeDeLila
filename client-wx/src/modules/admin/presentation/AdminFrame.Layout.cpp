#include "modules/admin/presentation/AdminFrame.h"

#include <span>

#include <wx/sizer.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "shared/accessibility/presentation/NonFocusablePanel.h"
#include "shared/ui/presentation/controls/VerticalMenu.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::BuildLayout()
{
    SetMinSize(wxSize(1100, 760));
    auto* rootSizer = new wxBoxSizer(wxVERTICAL);
    titleLabel_ = new wxStaticText(this, wxID_ANY, wxString(L"Administration"));
    rootSizer->Add(titleLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxTOP, 24);

    auto* content = new lila::shared::accessibility::NonFocusablePanel(this);
    auto* contentSizer = new wxBoxSizer(wxHORIZONTAL);
    const std::span<const lila::shared::ui::controls::VerticalMenuItem> empty;
    sectionsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        content, empty, lila::shared::ui::controls::VerticalMenuRole::Entries);
    commandsMenu_ = new lila::shared::ui::controls::VerticalMenu(
        content, empty, lila::shared::ui::controls::VerticalMenuRole::Entries);
    sectionsMenu_->SetMinSize(wxSize(360, -1));
    commandsMenu_->SetMinSize(wxSize(420, -1));

    resultText_ = new wxTextCtrl(
        content, wxID_ANY, wxString{}, wxDefaultPosition, wxDefaultSize,
        wxTE_MULTILINE | wxTE_READONLY | wxTE_DONTWRAP);
    resultText_->SetName(wxString(L"Résultat de l'opération administrateur"));
    contentSizer->Add(sectionsMenu_, 0, wxEXPAND | wxRIGHT, 16);
    contentSizer->Add(commandsMenu_, 0, wxEXPAND | wxRIGHT, 16);
    contentSizer->Add(resultText_, 1, wxEXPAND);
    content->SetSizer(contentSizer);
    rootSizer->Add(content, 1, wxEXPAND | wxALL, 24);

    statusLabel_ = new wxStaticText(
        this, wxID_ANY,
        wxString(L"Flèches : naviguer. Entrée : ouvrir ou valider. Échap : revenir à l’écran précédent."));
    rootSizer->Add(statusLabel_, 0, wxEXPAND | wxLEFT | wxRIGHT | wxBOTTOM, 24);
    SetSizer(rootSizer);
}
}
