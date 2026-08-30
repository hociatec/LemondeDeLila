#pragma once

#include <string>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/state/domain/GameState.h"

class wxListBox;

namespace lila::modules::gameplay::presentation::workflows
{
class GameWorkflowPanel final : public wxPanel
{
public:
    explicit GameWorkflowPanel(wxWindow* parent);
    void Apply(const domain::GameState& state);
    void Clear();
    [[nodiscard]] wxWindow* NavigationTarget() const;
private:
    [[nodiscard]] std::string SelectedKey() const;
    wxListBox* rows_ = nullptr;
    std::vector<std::string> rowKeys_;
    std::vector<std::string> rowLabels_;
};
}
