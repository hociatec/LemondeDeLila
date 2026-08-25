#pragma once

#include <cstddef>
#include <vector>

#include <wx/panel.h>
#include <wx/string.h>

#include "modules/gameplay/cards/domain/GameCard.h"

class wxListBox;
class wxWindow;

namespace lila::modules::gameplay::presentation::hand
{
class GameHandPanel final : public wxPanel
{
public:
    explicit GameHandPanel(wxWindow* parent);

    void ApplyCards(const std::vector<domain::GameCard>& cards);
    void ClearHand();
    bool MoveSelection(bool backwards);
    [[nodiscard]] int SelectedIndex() const noexcept;
    [[nodiscard]] std::size_t Count() const noexcept;
    [[nodiscard]] wxString SelectedLabel() const;

private:
    wxListBox* list_ = nullptr;
};
}
