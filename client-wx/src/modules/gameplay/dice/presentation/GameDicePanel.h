#pragma once

#include <cstddef>

#include <wx/panel.h>
#include <wx/string.h>

#include "modules/gameplay/dice/domain/GameDiceState.h"

class wxListBox;

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
    [[nodiscard]] wxString SelectedLabel() const;

private:
    wxListBox* list_ = nullptr;
};
}
