#include "modules/gameplay/grid/presentation/GameGridPanel.h"

#include <algorithm>
#include <sstream>

#include <nlohmann/json.hpp>
#include <wx/event.h>
#include <wx/listbox.h>
#include <wx/sizer.h>

#include "modules/gameplay/information/application/GameCapabilityTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::grid
{
namespace
{
std::string DescribeCell(
    const std::string& boardId,
    const std::string& id,
    const nlohmann::json& cell,
    const nlohmann::json& overlays)
{
    std::ostringstream out;
    out << "Plateau " << boardId << ", case " << id;
    if (cell.is_object())
    {
        if (cell.value("blocked", false)) out << ", bloquée";
        else out << ", occupée";
        if (cell.value("wall", false)) out << ", mur";
        const auto occupied = cell.find("occupied");
        if (occupied != cell.end() && occupied->is_boolean() && occupied->get<bool>())
            out << ", occupée";
        for (const char* key : {"entity", "entityId", "pawnId", "ownerId", "label"})
        {
            const auto value = cell.find(key);
            if (value != cell.end() && value->is_primitive())
                out << ", " << key << " " << value->dump();
        }
    }
    else if (cell.is_null()) out << ", libre";
    else out << ", occupée, " << application::info::GameCapabilityTextBuilder::JsonLines(cell);
    if (overlays.is_object())
        for (const auto& layer : overlays.items())
        {
            if (!layer.value().is_array()) continue;
            for (const auto& overlay : layer.value())
            {
                if (!overlay.is_object()) continue;
                const auto position = overlay.value("position", nlohmann::json::object());
                const auto overlayId = overlay.value("cellId",
                    overlay.value("tileId", std::string{}));
                const bool matchesId = !overlayId.empty() && overlayId == id;
                const bool matchesPosition = position.is_object() &&
                    std::to_string(position.value("x", -1)) + "," +
                        std::to_string(position.value("y", -1)) == id;
                if (matchesId || matchesPosition) out << ", couche " << layer.key();
            }
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

void GameGridPanel::Apply(const nlohmann::json& gridKit)
{
    const auto previous = SelectedCellId();
    Clear();
    const auto boards = gridKit.find("boards");
    if (boards == gridKit.end() || !boards->is_object()) return;
    for (const auto& board : boards->items())
    {
        if (!board.value().is_object()) continue;
        const int width = std::max(1, board.value().value("width", 1));
        const int height = std::max(1, board.value().value("height", 1));
        const auto cells = board.value().find("cells");
        if (cells == board.value().end() || !cells->is_object()) continue;
        const auto overlays = board.value().value("overlays", nlohmann::json::object());
        for (int y = 0; y < height; ++y)
            for (int x = 0; x < width; ++x)
            {
                const auto id = std::to_string(x) + "," + std::to_string(y);
                const auto cell = cells->find(id);
                const auto value = cell == cells->end() ? nlohmann::json(nullptr) : *cell;
                model_.push_back({board.key(), id,
                    DescribeCell(board.key(), id, value, overlays), x, y});
            }
    }
    for (const auto& cell : model_) cells_->Append(FromUtf8(cell.description));
    if (!model_.empty())
    {
        const auto found = std::find_if(model_.begin(), model_.end(),
            [&previous](const Cell& cell) { return cell.id == previous; });
        cells_->SetSelection(found == model_.end() ? 0 :
            static_cast<int>(std::distance(model_.begin(), found)));
    }
    Show(!model_.empty());
}

void GameGridPanel::Clear()
{
    model_.clear();
    cells_->Clear();
    Hide();
}

bool GameGridPanel::HandleKey(wxKeyEvent& event)
{
    if (!IsShown() || wxWindow::FindFocus() != cells_ || model_.empty()) return false;
    const int current = std::max(0, cells_->GetSelection());
    auto x = model_[static_cast<std::size_t>(current)].x;
    auto y = model_[static_cast<std::size_t>(current)].y;
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

wxWindow* GameGridPanel::NavigationTarget() const { return cells_; }
}
