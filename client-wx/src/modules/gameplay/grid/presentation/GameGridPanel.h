#pragma once

#include <string>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/state/domain/GameCapabilities.h"
#include "modules/gameplay/state/domain/GameSystem.h"

class wxKeyEvent;
class wxListBox;

namespace lila::modules::gameplay::presentation::grid
{
class GameGridPanel final : public wxPanel
{
public:
    explicit GameGridPanel(wxWindow* parent);
    void Apply(const domain::GameGridView* grid,
        const std::vector<domain::GameAction>& actions,
        const std::vector<domain::GamePlayer>& players);
    void Clear();
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] std::string SelectedCellId() const;
    [[nodiscard]] std::string SelectedBoardId() const;
    [[nodiscard]] int SelectedX() const;
    [[nodiscard]] int SelectedY() const;
    [[nodiscard]] wxWindow* NavigationTarget() const;

private:
    struct Cell final
    {
        std::string boardId;
        std::string id;
        std::string description;
        int x = 0;
        int y = 0;
    };
    wxListBox* cells_ = nullptr;
    std::vector<Cell> model_;
};
}
