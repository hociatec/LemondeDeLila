#pragma once

#include <string>
#include <vector>

#include <wx/panel.h>

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
    [[nodiscard]] wxWindow* NavigationTarget() const noexcept;

private:
    wxListBox* list_ = nullptr;
    std::vector<std::string> cardKeys_;
    std::vector<std::string> cardLabels_;
};
}
