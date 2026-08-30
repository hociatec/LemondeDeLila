#pragma once

#include <string>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/dice/domain/GameDiceState.h"

class wxListBox;
class wxWindow;

namespace lila::modules::gameplay::presentation::dice
{
class GameDicePanel final : public wxPanel
{
public:
    explicit GameDicePanel(wxWindow* parent);

    void Apply(const std::optional<domain::GameDiceState>& state);
    void Clear();
    bool MoveSelection(bool backwards);
    [[nodiscard]] int SelectedIndex() const noexcept;
    [[nodiscard]] wxWindow* NavigationTarget() const noexcept;

private:
    wxListBox* list_ = nullptr;
    std::vector<std::string> rowKeys_;
    std::vector<std::string> rowLabels_;
};
}
