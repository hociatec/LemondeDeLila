#pragma once

#include <functional>
#include <optional>
#include <string>

#include <wx/panel.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/pawn_selection/domain/PawnSelection.h"

class wxKeyEvent;
class wxListBox;
class wxStaticText;
class wxWindow;

namespace lila::modules::gameplay::presentation::pawn_selection
{
class PawnSelectionPanel final : public wxPanel
{
public:
    using SubmitHandler = std::function<void(domain::GameAction)>;
    using VisibilityChangedHandler = std::function<void(bool)>;

    explicit PawnSelectionPanel(wxWindow* parent);

    void SetSubmitHandler(SubmitHandler handler);
    void SetVisibilityChangedHandler(VisibilityChangedHandler handler);
    void Apply(const std::optional<domain::PawnSelection>& selection);
    void Clear();
    void AllowRetry();
    [[nodiscard]] bool IsActive() const;
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] bool FocusSelection();
    [[nodiscard]] wxWindow* NavigationTarget() const noexcept;

private:
    void Submit();
    [[nodiscard]] static std::string Signature(const domain::PawnSelection& selection);

    wxStaticText* label_ = nullptr;
    wxListBox* list_ = nullptr;
    domain::PawnSelection selection_;
    std::string signature_;
    bool submitting_ = false;
    SubmitHandler onSubmit_;
    VisibilityChangedHandler onVisibilityChanged_;
};
}
