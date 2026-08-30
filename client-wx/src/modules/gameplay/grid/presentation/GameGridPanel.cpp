#include "modules/gameplay/grid/presentation/GameGridPanel.h"

#include <algorithm>
#include <sstream>

#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/sizer.h>

#include "modules/gameplay/grid/application/GameGridActionResolver.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::grid
{
namespace
{
std::string PlayerName(const std::vector<domain::GamePlayer>& players, int id)
{
    const auto player = std::find_if(players.begin(), players.end(),
        [id](const domain::GamePlayer& value) { return value.id == id; });
    return player == players.end() ? "joueur " + std::to_string(id) : player->username;
}

bool Touches(const domain::GameGridOverlayView& overlay, const std::string& cellId)
{
    return overlay.cellId == cellId || overlay.fromCellId == cellId ||
        overlay.toCellId == cellId;
}

std::string OverlayText(const domain::GameGridOverlayView& overlay,
    const std::vector<domain::GamePlayer>& players)
{
    std::string kind = overlay.kind.empty() ? overlay.layer : overlay.kind;
    if (kind.find("wall") != std::string::npos || kind.find("mur") != std::string::npos)
        kind = "mur";
    else if (kind.find("pawn") != std::string::npos || kind.find("pion") != std::string::npos)
        kind = "pion";
    else if (kind.find("obstacle") != std::string::npos) kind = "obstacle";
    else if (kind.find("goal") != std::string::npos || kind.find("finish") != std::string::npos)
        kind = "objectif";
    if (!overlay.label.empty()) kind += " " + overlay.label;
    if (overlay.ownerId) kind += " de " + PlayerName(players, *overlay.ownerId);
    return kind;
}

std::string Describe(const domain::GameGridCellView& cell,
    const domain::GameGridBoardView& board,
    const std::vector<domain::GameAction>& actions,
    const std::vector<domain::GamePlayer>& players)
{
    std::ostringstream out;
    out << "Plateau " << board.id << ", case " << cell.id;
    if (cell.blocked) out << ", bloquée";
    else if (!cell.occupied) out << ", libre";
    else out << ", occupée";
    if (!cell.label.empty()) out << ", " << cell.label;
    if (!cell.pawnId.empty()) out << ", pion";
    else if (cell.kind == "wall") out << ", mur";
    else if (cell.kind == "obstacle") out << ", obstacle";
    else if (cell.kind == "goal") out << ", objectif";
    if (cell.ownerId) out << " de " << PlayerName(players, *cell.ownerId);
    for (const auto& overlay : board.overlays)
        if (Touches(overlay, cell.id)) out << ", " << OverlayText(overlay, players);
    bool first = true;
    for (const auto& action : actions)
        if (application::grid::GameGridActionResolver::Targets(action,
            {cell.boardId, cell.id, cell.x, cell.y}))
        {
            out << (first ? ", actions disponibles : " : ", ")
                << (action.label.empty() ? action.type : action.label);
            first = false;
        }
    return out.str();
}
}

GameGridPanel::GameGridPanel(wxWindow* parent) : wxPanel(parent)
{
    auto* layout = new wxBoxSizer(wxVERTICAL);
    cells_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    cells_->SetName(wxString(L"Grille de jeu. Flèches pour naviguer, Entrée pour activer."));
    layout->Add(cells_, 1, wxEXPAND);
    SetSizer(layout);
    Hide();
}

void GameGridPanel::Apply(const domain::GameGridView* grid,
    const std::vector<domain::GameAction>& actions,
    const std::vector<domain::GamePlayer>& players)
{
    const auto previousBoard = SelectedBoardId();
    const auto previousCell = SelectedCellId();
    Clear();
    if (grid == nullptr) return;
    for (const auto& board : grid->boards)
        for (const auto& cell : board.cells)
            model_.push_back({board.id, cell.id, Describe(cell, board, actions, players), cell.x, cell.y});
    for (const auto& cell : model_) cells_->Append(FromUtf8(cell.description));
    if (!model_.empty())
    {
        const auto found = std::find_if(model_.begin(), model_.end(),
            [&previousBoard, &previousCell](const Cell& cell)
            { return cell.boardId == previousBoard && cell.id == previousCell; });
        cells_->SetSelection(found == model_.end() ? 0 :
            static_cast<int>(std::distance(model_.begin(), found)));
    }
    Show(!model_.empty());
}

void GameGridPanel::Clear() { model_.clear(); cells_->Clear(); Hide(); }

bool GameGridPanel::HandleKey(wxKeyEvent& event)
{
    if (!IsShown() || wxWindow::FindFocus() != cells_ || model_.empty()) return false;
    const int current = std::max(0, cells_->GetSelection());
    int x = model_[static_cast<std::size_t>(current)].x;
    int y = model_[static_cast<std::size_t>(current)].y;
    if (event.GetKeyCode() == WXK_LEFT) --x;
    else if (event.GetKeyCode() == WXK_RIGHT) ++x;
    else if (event.GetKeyCode() == WXK_UP) --y;
    else if (event.GetKeyCode() == WXK_DOWN) ++y;
    else return false;
    const auto& boardId = model_[static_cast<std::size_t>(current)].boardId;
    const auto target = std::find_if(model_.begin(), model_.end(),
        [&boardId, x, y](const Cell& cell)
        { return cell.boardId == boardId && cell.x == x && cell.y == y; });
    if (target != model_.end())
        cells_->SetSelection(static_cast<int>(std::distance(model_.begin(), target)));
    return true;
}

std::string GameGridPanel::SelectedBoardId() const
{
    const int selection = cells_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= model_.size()
        ? std::string{} : model_[static_cast<std::size_t>(selection)].boardId;
}

std::string GameGridPanel::SelectedCellId() const
{
    const int selection = cells_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= model_.size()
        ? std::string{} : model_[static_cast<std::size_t>(selection)].id;
}

int GameGridPanel::SelectedX() const
{
    const int selection = cells_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= model_.size()
        ? -1 : model_[static_cast<std::size_t>(selection)].x;
}

int GameGridPanel::SelectedY() const
{
    const int selection = cells_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= model_.size()
        ? -1 : model_[static_cast<std::size_t>(selection)].y;
}

wxWindow* GameGridPanel::NavigationTarget() const { return cells_; }
}
