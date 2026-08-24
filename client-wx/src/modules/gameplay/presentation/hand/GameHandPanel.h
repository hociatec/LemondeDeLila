#pragma once

#include <nlohmann/json_fwd.hpp>
#include <wx/panel.h>

class wxListBox;
class wxWindow;

namespace lila::modules::gameplay::presentation::hand
{
class GameHandPanel final : public wxPanel
{
public:
    explicit GameHandPanel(wxWindow* parent);

    void ApplyExtras(const nlohmann::json& extras);
    void ClearHand();
    [[nodiscard]] wxListBox* List() const noexcept;

private:
    wxListBox* list_ = nullptr;
};
}
