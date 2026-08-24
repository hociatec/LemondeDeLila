#include "modules/gameplay/presentation/hand/GameHandPanel.h"

#include <nlohmann/json.hpp>
#include <wx/listbox.h>
#include <wx/sizer.h>
#include <wx/stattext.h>

#include "modules/gameplay/presentation/GamePlayFormatters.h"
#include "shared/ui/presentation/theme/Theme.h"

namespace lila::modules::gameplay::presentation::hand
{
GameHandPanel::GameHandPanel(wxWindow* parent)
    : wxPanel(parent, wxID_ANY)
{
    SetBackgroundColour(lila::shared::ui::Theme::PanelBackground());
    auto* root = new wxBoxSizer(wxVERTICAL);
    auto* label = new wxStaticText(this, wxID_ANY, wxString(L"Main"));
    label->SetForegroundColour(lila::shared::ui::Theme::Accent());
    root->Add(label, 0, wxEXPAND | wxBOTTOM, 4);
    list_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize, 0, nullptr,
        wxLB_SINGLE | wxWANTS_CHARS);
    list_->SetName(wxString(L"Votre main"));
    list_->SetMinSize(wxSize(260, 90));
    root->Add(list_, 1, wxEXPAND);
    SetSizer(root);
    Hide();
}

void GameHandPanel::ApplyExtras(const nlohmann::json& extras)
{
    const int previousSelection = list_->GetSelection();
    list_->Clear();
    const auto hand = extras.find("hand");
    if (hand != extras.end() && hand->is_array())
    {
        for (const auto& card : *hand)
        {
            if (card.is_string()) list_->Append(FromUtf8(card.get<std::string>()));
            else if (card.is_object())
            {
                const auto label = card.find("label");
                if (label != card.end() && label->is_string())
                    list_->Append(FromUtf8(label->get<std::string>()));
            }
        }
    }

    const bool hasHand = list_->GetCount() > 0;
    Show(hasHand);
    if (!hasHand) return;
    const int nextSelection = previousSelection != wxNOT_FOUND && previousSelection >= 0 &&
        static_cast<unsigned int>(previousSelection) < list_->GetCount()
        ? previousSelection
        : 0;
    list_->SetSelection(nextSelection);
}

void GameHandPanel::ClearHand()
{
    list_->Clear();
    Hide();
}

wxListBox* GameHandPanel::List() const noexcept { return list_; }
}
