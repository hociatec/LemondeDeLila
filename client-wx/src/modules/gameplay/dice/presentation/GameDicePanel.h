#pragma once

#include <functional>
#include <optional>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/dice/domain/GameDiceState.h"

class wxButton;
class wxStaticText;

namespace lila::modules::gameplay::presentation::dice
{
class GameDicePanel final : public wxPanel
{
public:
    using ActivateHandler = std::function<void(domain::GameAction)>;

    explicit GameDicePanel(wxWindow* parent);
    void Apply(
        const domain::GameDiceState* dice,
        const std::vector<domain::GameAction>& actions);
    void Clear();
    void SetActivateHandler(ActivateHandler handler);
    [[nodiscard]] wxWindow* NavigationTarget() const;
    [[nodiscard]] std::optional<domain::GameAction> ResolveAction() const;

private:
    wxButton* rollButton_ = nullptr;
    wxStaticText* resultLabel_ = nullptr;
    std::optional<domain::GameAction> action_;
    ActivateHandler onActivate_;
};
}
