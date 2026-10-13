#include "modules/shortcuts/presentation/ShortcutManagerFrame.h"
#include "modules/shortcuts/application/ShortcutStore.h"
#include "shared/accessibility/presentation/AccessibilityUtils.h"
#include "shared/accessibility/presentation/NavigationController.h"
#include "shared/text/presentation/encoding/Encoding.h"
#include "shared/ui/presentation/theme/Theme.h"
#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/sizer.h>

namespace lila::modules::shortcuts::presentation
{
ShortcutManagerFrame::ShortcutManagerFrame(wxWindow* parent, application::ShortcutStore& store,
    lila::modules::catalog::application::CatalogService& catalog, int userId, bool admin, bool beta,
    std::function<void()> onClose)
    : NonFocusablePanel(parent), store_(store), catalog_(catalog), userId_(userId),
      admin_(admin), beta_(beta), onClose_(std::move(onClose))
{
    snapshot_ = store_.Current(userId_);
    targets_ = domain::FunctionTargets(admin_);
    BuildLayout();
    Render();
}
void ShortcutManagerFrame::BuildLayout()
{
    auto* sizer = new wxBoxSizer(wxVERTICAL);
    sizer->Add(new wxStaticText(this, wxID_ANY, L"Gestionnaire de raccourcis"), 0, wxALL, 16);
    sizer->Add(new wxStaticText(this, wxID_ANY,
        L"Raccourcis personnels utilisables partout dans l'application. Jusqu'à 50 raccourcis."), 0, wxALL, 10);
    list_ = new wxListBox(this, wxID_ANY);
    sizer->Add(list_, 1, wxEXPAND | wxALL, 10);
    auto* buttons = new wxBoxSizer(wxHORIZONTAL);
    const auto button = [&](wxButton*& control, const wchar_t* label, auto action)
    {
        control = new wxButton(this, wxID_ANY, label);
        control->Bind(wxEVT_BUTTON, [action](wxCommandEvent&) { action(); });
        buttons->Add(control, 0, wxRIGHT, 8);
    };
    button(add_, L"Ajouter", [this] { Edit(true); });
    button(edit_, L"Modifier", [this] { Edit(false); });
    button(toggle_, L"Activer / désactiver", [this] { Toggle(); });
    button(remove_, L"Supprimer", [this] { Remove(); });
    button(reset_, L"Réinitialiser", [this] { Reset(); });
    button(refresh_, L"Actualiser", [this] { Reload(); });
    button(back_, L"Retour", [this] { if (!busy_) onClose_(); });
    sizer->Add(buttons, 0, wxALL, 10);
    status_ = new wxStaticText(this, wxID_ANY, wxEmptyString);
    sizer->Add(status_, 0, wxEXPAND | wxALL, 10);
    SetSizer(sizer);
    SetBackgroundColour(lila::shared::ui::Theme::Background());
    using A = lila::shared::accessibility::AccessibilityUtils;
    A::SetAccessibleName(*list_, L"Mes raccourcis : destination, combinaison et état");
    list_->Bind(wxEVT_LISTBOX, [this](wxCommandEvent&) { Busy(busy_); });
    list_->Bind(wxEVT_LISTBOX_DCLICK, [this](wxCommandEvent&) { Edit(false); });
    list_->Bind(wxEVT_CHAR_HOOK, [this](wxKeyEvent& e)
    {
        if (e.GetKeyCode() == WXK_RETURN) Edit(false);
        else if (e.GetKeyCode() == WXK_DELETE) Remove();
        else e.Skip();
    });
    using N = lila::shared::accessibility::NavigationController;
    N::BindTabNavigation(*this, [this] { N::Scope s; s.Add({list_, add_, edit_, toggle_, remove_, reset_, refresh_, back_}); return s; });
    N::BindEscapeNavigation(*this, [this] { if (!busy_) onClose_(); return true; });
}
void ShortcutManagerFrame::Status(const wxString& text)
{
    status_->SetLabel(text);
    lila::shared::accessibility::AccessibilityUtils::SetAccessibleStatus(*status_, text);
    lila::shared::accessibility::AccessibilityUtils::AnnounceStatus(*status_, text);
    Layout();
}
void ShortcutManagerFrame::Busy(bool value)
{
    busy_ = value;
    const bool selected = list_->GetSelection() != wxNOT_FOUND;
    add_->Enable(!busy_ && snapshot_.synchronized && snapshot_.items.size() < 50);
    for (auto* button : {edit_, toggle_, remove_}) button->Enable(!busy_ && snapshot_.synchronized && selected);
    reset_->Enable(!busy_ && snapshot_.synchronized && !snapshot_.items.empty());
    refresh_->Enable(!busy_); back_->Enable(!busy_);
}
void ShortcutManagerFrame::Render()
{
    const auto selected = list_->GetSelection();
    list_->Clear();
    for (const auto& item : snapshot_.items)
        list_->Append(lila::shared::text::FromUtf8(item.label + " — " + item.chord +
            (item.enabled ? " — activé" : " — désactivé")));
    if (!snapshot_.items.empty())
        list_->SetSelection(selected >= 0 && static_cast<std::size_t>(selected) < snapshot_.items.size() ? selected : 0);
    Busy(false);
}
lila::shared::accessibility::FocusManager::Plan ShortcutManagerFrame::BuildFocusPlan()
{
    lila::shared::accessibility::FocusManager::Plan plan;
    plan.AddWindow(list_); plan.AddWindow(add_); return plan;
}
}
