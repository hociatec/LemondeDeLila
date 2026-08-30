#include "modules/gameplay/movement/presentation/GameMovementPanel.h"

#include <algorithm>

#include <wx/listbox.h>
#include <wx/sizer.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::movement
{
namespace
{
std::string Player(const std::vector<domain::GamePlayer>& players, int id)
{
    const auto found = std::find_if(players.begin(), players.end(),
        [id](const domain::GamePlayer& player) { return player.id == id; });
    return found == players.end() ? "Joueur " + std::to_string(id) : found->username;
}
}

GameMovementPanel::GameMovementPanel(wxWindow* parent) : wxPanel(parent)
{
    auto* layout = new wxBoxSizer(wxVERTICAL);
    rows_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    rows_->SetName(wxString(L"Pistes et pions. Liste navigable."));
    layout->Add(rows_, 1, wxEXPAND);
    SetSizer(layout);
    Hide();
}

void GameMovementPanel::Apply(
    const domain::GameKits& kits, const std::vector<domain::GamePlayer>& players)
{
    Clear();
    if (kits.movement)
        for (const auto& track : kits.movement->tracks)
            for (const auto& [entity, position] : track.positions)
            {
                std::string label = entity;
                try { label = Player(players, std::stoi(entity)); } catch (const std::exception&) {}
                label += ", piste " + track.id + ", case " + std::to_string(position);
                if (track.spaces > 1)
                    label += ", progression " + std::to_string(100 * position / (track.spaces - 1)) + " %";
                rows_->Append(FromUtf8(label));
            }
    if (kits.pawns)
        for (const auto& pawn : kits.pawns->pawns)
        {
            auto label = pawn.label + ", position " + std::to_string(pawn.position);
            if (pawn.ownerId) label += ", pion de " + Player(players, *pawn.ownerId);
            rows_->Append(FromUtf8(label));
        }
    if (rows_->GetCount() > 0) rows_->SetSelection(0);
    Show(rows_->GetCount() > 0);
}

void GameMovementPanel::Clear() { rows_->Clear(); Hide(); }
wxWindow* GameMovementPanel::NavigationTarget() const
{
    return IsShown() && rows_->GetCount() > 0 ? rows_ : nullptr;
}
}
