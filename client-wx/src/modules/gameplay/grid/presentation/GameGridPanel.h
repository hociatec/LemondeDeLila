#pragma once

#include <string>
#include <vector>

#include <nlohmann/json_fwd.hpp>
#include <wx/panel.h>

class wxKeyEvent;
class wxListBox;

namespace lila::modules::gameplay::presentation::grid
{
class GameGridPanel final : public wxPanel
{
public:
    explicit GameGridPanel(wxWindow* parent);
    void Apply(const nlohmann::json& gridKit);
    void Clear();
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] std::string SelectedCellId() const;
    [[nodiscard]] std::string SelectedBoardId() const;
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
