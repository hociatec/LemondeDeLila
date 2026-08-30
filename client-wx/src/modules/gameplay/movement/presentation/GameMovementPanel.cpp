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
    const auto previousKey = SelectedKey();
    std::vector<std::string> nextKeys;
    std::vector<std::string> nextLabels;
    if (kits.movement)
        for (const auto& track : kits.movement->tracks)
            for (const auto& [entity, position] : track.positions)
            {
                std::string label = entity;
                try { label = Player(players, std::stoi(entity)); } catch (const std::exception&) {}
                label += ", piste " + track.id + ", case " + std::to_string(position);
                if (track.spaces > 1)
                    label += ", progression " + std::to_string(100 * position / (track.spaces - 1)) + " %";
                nextLabels.push_back(std::move(label));
                nextKeys.push_back("track:" + track.id + ":" + entity);
            }
    if (kits.pawns)
        for (const auto& pawn : kits.pawns->pawns)
        {
            auto label = pawn.label + ", position " + std::to_string(pawn.position);
            if (pawn.ownerId) label += ", pion de " + Player(players, *pawn.ownerId);
            nextLabels.push_back(std::move(label));
            nextKeys.push_back("pawn:" + pawn.setId + ":" + pawn.id);
        }
    if (nextKeys == rowKeys_ && nextLabels == rowLabels_) return;
    rows_->Clear();
    rowKeys_ = std::move(nextKeys);
    rowLabels_ = std::move(nextLabels);
    for (const auto& label : rowLabels_) rows_->Append(FromUtf8(label));
    if (rows_->GetCount() > 0)
    {
        const auto found = std::find(rowKeys_.begin(), rowKeys_.end(), previousKey);
        rows_->SetSelection(found == rowKeys_.end() ? 0
            : static_cast<int>(std::distance(rowKeys_.begin(), found)));
    }
    Show(rows_->GetCount() > 0);
}

void GameMovementPanel::Clear()
{
    rowKeys_.clear(); rowLabels_.clear(); rows_->Clear(); Hide();
}
std::string GameMovementPanel::SelectedKey() const
{
    const int selection = rows_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= rowKeys_.size()
        ? std::string{} : rowKeys_[static_cast<std::size_t>(selection)];
}
wxWindow* GameMovementPanel::NavigationTarget() const
{
    return IsShown() && rows_->GetCount() > 0 ? rows_ : nullptr;
}
}
