#pragma once

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
    wxListBox* rows_ = nullptr;
};
}
