#pragma once

#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"

class wxButton;
class wxCheckBox;
class wxKeyEvent;
class wxSizer;
class wxStaticText;
class wxTextCtrl;
class wxWindow;

namespace lila::modules::gameplay::presentation::prompt
{
class GamePromptPanel final : public wxPanel
{
public:
    using SubmitHandler = std::function<void(domain::GameAction)>;
    using CancelHandler = std::function<void(std::string)>;
    using ValidationErrorHandler = std::function<void(const wxString&, wxWindow*)>;
    using VisibilityChangedHandler = std::function<void(bool)>;

    explicit GamePromptPanel(wxWindow* parent);

    void SetSubmitHandler(SubmitHandler handler);
    void SetCancelHandler(CancelHandler handler);
    void SetValidationErrorHandler(ValidationErrorHandler handler);
    void SetVisibilityChangedHandler(VisibilityChangedHandler handler);

    void ShowPrompt(const domain::GamePrompt& prompt, domain::GameAction action);
    void HidePrompt(bool clearSignature = false);
    [[nodiscard]] bool IsActive() const;
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] std::vector<wxWindow*> TabTargets() const;

private:
    struct FieldControl final
    {
        domain::GamePromptField field;
        wxTextCtrl* text = nullptr;
        wxCheckBox* checkbox = nullptr;
    };

    void BuildLayout();
    void RebuildFields(const domain::GamePrompt& prompt);
    void Submit();
    void Cancel();
    void FocusFirst();
    [[nodiscard]] static std::string BuildSignature(const domain::GamePrompt& prompt);

    wxStaticText* title_ = nullptr;
    wxSizer* fieldsSizer_ = nullptr;
    wxButton* cancelButton_ = nullptr;
    wxButton* submitButton_ = nullptr;
    std::vector<FieldControl> fields_;
    std::optional<domain::GameAction> action_;
    std::string cancelActionType_;
    std::string signature_;
    SubmitHandler onSubmit_;
    CancelHandler onCancel_;
    ValidationErrorHandler onValidationError_;
    VisibilityChangedHandler onVisibilityChanged_;
};
}
