#include "modules/gameplay/pawn_selection/presentation/PawnSelectionPanel.h"

#include <sstream>
#include <utility>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "shared/accessibility/application/NavigationController.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::pawn_selection
{
PawnSelectionPanel::PawnSelectionPanel(wxWindow* parent)
    : wxPanel(parent, wxID_ANY)
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);
    label_ = new wxStaticText(this, wxID_ANY, wxString(L"Votre pion."));
    label_->SetForegroundColour(lila::shared::ui::Theme::Accent());
    label_->SetFont(lila::shared::ui::Theme::TitleFont());
    root->Add(label_, 0, wxEXPAND | wxBOTTOM, 6);
    list_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    list_->SetName(wxString(L"Votre pion."));
    list_->SetMinSize(wxSize(260, 120));
    root->Add(list_, 1, wxEXPAND);
    SetSizer(root);
    Hide();
    list_->Bind(wxEVT_LISTBOX_DCLICK, [this](wxCommandEvent&) { Submit(); });
    list_->Bind(
        wxEVT_KEY_DOWN,
        [this](wxKeyEvent& event)
        {
            const int key = event.GetKeyCode();
            if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
            {
                Submit();
                return;
            }
            event.Skip();
        });
}

void PawnSelectionPanel::SetSubmitHandler(SubmitHandler handler)
{
    onSubmit_ = std::move(handler);
}

void PawnSelectionPanel::SetVisibilityChangedHandler(VisibilityChangedHandler handler)
{
    onVisibilityChanged_ = std::move(handler);
}

std::string PawnSelectionPanel::Signature(const domain::PawnSelection& selection)
{
    std::ostringstream value;
    value << selection.pendingType;
    for (const auto& choice : selection.choices)
        value << '|' << choice.label << ':' << choice.action.type << ':' << choice.action.payload.dump();
    return value.str();
}

void PawnSelectionPanel::Apply(const std::optional<domain::PawnSelection>& selection)
{
    if (!selection)
    {
        Clear();
        return;
    }
    const auto nextSignature = Signature(*selection);
    const bool changed = nextSignature != signature_;
    selection_ = *selection;
    label_->SetLabel(FromUtf8(selection_.label));
    list_->SetName(FromUtf8(selection_.label));
    if (changed)
    {
        submitting_ = false;
        signature_ = nextSignature;
        list_->Clear();
        for (const auto& choice : selection_.choices) list_->Append(FromUtf8(choice.label));
        if (list_->GetCount() > 0) list_->SetSelection(0);
    }
    const bool becameVisible = !IsShown();
    Show();
    if (becameVisible && onVisibilityChanged_) onVisibilityChanged_(true);
    Layout();
    if (changed) static_cast<void>(FocusSelection());
}

void PawnSelectionPanel::Clear()
{
    const bool wasVisible = IsShown();
    Hide();
    list_->Clear();
    selection_ = {};
    signature_.clear();
    submitting_ = false;
    if (wasVisible && onVisibilityChanged_) onVisibilityChanged_(false);
}

void PawnSelectionPanel::AllowRetry() { submitting_ = false; }

bool PawnSelectionPanel::IsActive() const { return IsShown(); }

bool PawnSelectionPanel::FocusSelection()
{
    if (!IsActive() || list_->GetCount() == 0) return false;
    if (list_->GetSelection() == wxNOT_FOUND) list_->SetSelection(0);
    return lila::shared::accessibility::NavigationController::Focus(list_);
}

wxWindow* PawnSelectionPanel::NavigationTarget() const noexcept
{
    return IsActive() && list_->GetCount() > 0 ? list_ : nullptr;
}

void PawnSelectionPanel::Submit()
{
    if (!IsActive() || submitting_) return;
    const int selected = list_->GetSelection();
    if (selected == wxNOT_FOUND || selected < 0 ||
        static_cast<std::size_t>(selected) >= selection_.choices.size()) return;
    submitting_ = true;
    if (onSubmit_) onSubmit_(selection_.choices[static_cast<std::size_t>(selected)].action);
}

bool PawnSelectionPanel::HandleKey(wxKeyEvent& event)
{
    if (!IsActive()) return false;
    const int key = event.GetKeyCode();
    if (key == WXK_RETURN || key == WXK_NUMPAD_ENTER)
    {
        Submit();
        return true;
    }
    return false;
}
}
