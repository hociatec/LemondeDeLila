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
    rows_->SetName(wxString(L"Résultats, ressources, inventaires et marché. Liste navigable."));
    layout->Add(rows_, 1, wxEXPAND);
    SetSizer(layout);
    Hide();
}

void GameResourcesPanel::Apply(const domain::GameState& state)
{
    const auto previousKey = SelectedKey();
    std::vector<std::string> nextKeys;
    std::vector<std::string> nextLabels;
    const auto append = [&nextKeys, &nextLabels](std::string key, std::string label)
    {
        nextKeys.push_back(std::move(key));
        nextLabels.push_back(std::move(label));
    };
    const auto appendSection = [&append](std::string key, std::string label)
    {
        append("section:" + std::move(key), "— " + std::move(label) + " —");
    };
    if (state.kits.score)
    {
        appendSection("scores", state.kits.score->label);
        for (const auto& score : state.kits.score->leaderboard)
        {
            append("score:" + std::to_string(score.playerId), std::to_string(score.rank) + ". " +
                Player(state, score.playerId) + " : " + Amount(score.score) + " " +
                state.kits.score->UnitFor(score.score));
        }
    }
    if (state.kits.resources && std::any_of(
        state.kits.resources->players.begin(), state.kits.resources->players.end(),
        [](const auto& player) { return !player.values.empty(); }))
    {
        appendSection("resources", "Ressources");
        for (const auto& player : state.kits.resources->players)
            for (const auto& value : player.values)
            {
                append("resource:" + std::to_string(player.playerId) + ":" + value.id,
                    Player(state, player.playerId) + ", " +
                    application::info::HumanLabel(value.id) + " : " + Amount(value.value));
            }
    }
    if (state.kits.counters && !state.kits.counters->values.empty())
    {
        appendSection("counters", "Compteurs");
        for (const auto& value : state.kits.counters->values)
        {
            append("counter:" + value.id, std::string("Compteur ") +
                application::info::HumanLabel(value.id) + " : " + Amount(value.value));
        }
    }
    if (state.kits.inventory && std::any_of(
        state.kits.inventory->sets.begin(), state.kits.inventory->sets.end(),
        [](const auto& set) { return !set.players.empty(); }))
    {
        appendSection("inventory", "Inventaires");
        for (const auto& set : state.kits.inventory->sets)
            for (const auto& player : set.players)
            {
                if (player.hiddenCount)
                {
                    append("inventory:" + set.id + ":" +
                        std::to_string(player.playerId) + ":hidden",
                        Player(state, player.playerId) + ", " +
                        std::to_string(*player.hiddenCount) + " objet(s) masqué(s)");
                }
                for (const auto& [item, count] : player.quantities)
                {
                    append("inventory:" + set.id + ":" +
                        std::to_string(player.playerId) + ":" + item,
                        Player(state, player.playerId) + ", " +
                        application::info::HumanLabel(item) + " : " + std::to_string(count));
                }
            }
    }
    if (state.kits.economy && std::any_of(
        state.kits.economy->markets.begin(), state.kits.economy->markets.end(),
        [](const auto& market) { return !market.prices.empty(); }))
    {
        appendSection("economy", "Marché");
        for (const auto& market : state.kits.economy->markets)
            for (const auto& price : market.prices)
            {
                append("market:" + market.id + ":" + price.id,
                    application::info::HumanLabel(price.id) + " : " + Amount(price.value) +
                    " " + application::info::HumanLabel(market.currency));
            }
    }
    if (state.kits.collections && std::any_of(
        state.kits.collections->players.begin(), state.kits.collections->players.end(),
        [](const auto& collection) { return !collection.groups.empty(); }))
    {
        appendSection("collections", "Collections");
        for (const auto& collection : state.kits.collections->players)
            for (const auto& group : collection.groups)
            {
                std::string label = Player(state, collection.playerId) + ", collection " +
                    application::info::HumanLabel(collection.collectionId) + ", groupe " +
                    application::info::HumanLabel(group.id) + " : " +
                    std::to_string(group.count) + " élément(s)";
                if (!group.items.empty())
                {
                    label += " — ";
                    for (std::size_t index = 0; index < group.items.size(); ++index)
                    {
                        if (index > 0) label += ", ";
                        label += application::info::HumanLabel(group.items[index]);
                    }
                }
                append("collection:" + collection.collectionId + ":" +
                    std::to_string(collection.playerId) + ":" + group.id, std::move(label));
            }
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

void GameResourcesPanel::Clear()
{
    rowKeys_.clear(); rowLabels_.clear(); rows_->Clear(); Hide();
}
std::string GameResourcesPanel::SelectedKey() const
{
    const int selection = rows_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= rowKeys_.size()
        ? std::string{} : rowKeys_[static_cast<std::size_t>(selection)];
}
wxWindow* GameResourcesPanel::NavigationTarget() const
{
    return IsShown() && rows_->GetCount() > 0 ? rows_ : nullptr;
}
}
