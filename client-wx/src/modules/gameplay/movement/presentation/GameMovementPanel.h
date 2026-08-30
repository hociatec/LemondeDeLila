#pragma once

#include <string>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/state/domain/GameKits.h"
#include "modules/gameplay/state/domain/GameSystem.h"

class wxListBox;

namespace lila::modules::gameplay::presentation::movement
{
class GameMovementPanel final : public wxPanel
{
public:
    explicit GameMovementPanel(wxWindow* parent);
    void Apply(const domain::GameKits& kits, const std::vector<domain::GamePlayer>& players);
    void Clear();
    [[nodiscard]] wxWindow* NavigationTarget() const;
private:
    [[nodiscard]] std::string SelectedKey() const;
    wxListBox* rows_ = nullptr;
    std::vector<std::string> rowKeys_;
    std::vector<std::string> rowLabels_;
};
}
