#pragma once

#include <wx/panel.h>

#include "modules/gameplay/state/domain/GameState.h"

class wxListBox;

namespace lila::modules::gameplay::presentation::resources
{
class GameResourcesPanel final : public wxPanel
{
public:
    explicit GameResourcesPanel(wxWindow* parent);
    void Apply(const domain::GameState& state);
    void Clear();
    [[nodiscard]] wxWindow* NavigationTarget() const;
private:
    wxListBox* rows_ = nullptr;
};
}
