#pragma once

#include <cstddef>

#include <nlohmann/json_fwd.hpp>
#include <wx/panel.h>
#include <wx/string.h>

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
    bool MoveSelection(bool backwards);
    [[nodiscard]] int SelectedIndex() const noexcept;
    [[nodiscard]] std::size_t Count() const noexcept;
    [[nodiscard]] wxString SelectedLabel() const;

private:
    wxListBox* list_ = nullptr;
};
}
