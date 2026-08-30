#include "modules/gameplay/resources/presentation/GameResourcesPanel.h"

#include <algorithm>
#include <cmath>

#include <wx/listbox.h>
#include <wx/sizer.h>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::resources
{
namespace
{
std::string Player(const domain::GameState& state, int id)
{
    const auto found = std::find_if(state.system.players.begin(), state.system.players.end(),
        [id](const domain::GamePlayer& player) { return player.id == id; });
    return found == state.system.players.end() ? "Joueur " + std::to_string(id) : found->username;
}
std::string Amount(double value)
{
    return std::trunc(value) == value ? std::to_string(static_cast<long long>(value))
                                     : std::to_string(value);
}
}

GameResourcesPanel::GameResourcesPanel(wxWindow* parent) : wxPanel(parent)
{
    auto* layout = new wxBoxSizer(wxVERTICAL);
    rows_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    rows_->SetName(wxString(L"Scores, ressources, inventaires et marché. Liste navigable."));
    layout->Add(rows_, 1, wxEXPAND);
    SetSizer(layout);
    Hide();
}

void GameResourcesPanel::Apply(const domain::GameState& state)
{
    Clear();
    if (state.kits.score)
        for (const auto& score : state.kits.score->leaderboard)
            rows_->Append(FromUtf8(std::to_string(score.rank) + ". " +
                Player(state, score.playerId) + " : " + Amount(score.score) + " points"));
    if (state.kits.resources)
        for (const auto& player : state.kits.resources->players)
            for (const auto& value : player.values)
                rows_->Append(FromUtf8(Player(state, player.playerId) + ", " +
                    application::info::HumanLabel(value.id) + " : " + Amount(value.value)));
    if (state.kits.inventory)
        for (const auto& set : state.kits.inventory->sets)
            for (const auto& player : set.players)
            {
                if (player.hiddenCount)
                    rows_->Append(FromUtf8(Player(state, player.playerId) + ", " +
                        std::to_string(*player.hiddenCount) + " objet(s) masqué(s)"));
                for (const auto& [item, count] : player.quantities)
                    rows_->Append(FromUtf8(Player(state, player.playerId) + ", " +
                        application::info::HumanLabel(item) + " : " + std::to_string(count)));
            }
    if (state.kits.economy)
        for (const auto& market : state.kits.economy->markets)
            for (const auto& price : market.prices)
                rows_->Append(FromUtf8(application::info::HumanLabel(price.id) + " : " +
                    Amount(price.value) + " " + application::info::HumanLabel(market.currency)));
    if (rows_->GetCount() > 0) rows_->SetSelection(0);
    Show(rows_->GetCount() > 0);
}

void GameResourcesPanel::Clear() { rows_->Clear(); Hide(); }
wxWindow* GameResourcesPanel::NavigationTarget() const
{
    return IsShown() && rows_->GetCount() > 0 ? rows_ : nullptr;
}
}
