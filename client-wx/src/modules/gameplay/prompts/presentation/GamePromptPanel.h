#pragma once

#include <functional>
#include <optional>
#include <string>
#include <vector>

#include <wx/panel.h>

#include "modules/gameplay/actions/domain/GameAction.h"
#include "modules/gameplay/prompts/domain/GamePrompt.h"
#include "modules/gameplay/session/domain/GameActionCandidates.h"

class wxButton;
class wxCheckBox;
class wxCheckListBox;
class wxChoice;
class wxKeyEvent;
class wxListBox;
class wxSizer;
class wxStaticText;
class wxTextCtrl;
class wxWindow;
class wxRearrangeCtrl;

namespace lila::modules::gameplay::presentation::prompt
{
class GamePromptPanel final : public wxPanel
{
public:
    using SubmitHandler = std::function<void(domain::GameAction)>;
    using CancelHandler = std::function<void(std::string)>;
    using ValidationErrorHandler = std::function<void(const wxString&, wxWindow*)>;
    using VisibilityChangedHandler = std::function<void(bool)>;
    using CandidatesRequestHandler = std::function<void(domain::GameActionCandidatesRequest)>;

    explicit GamePromptPanel(wxWindow* parent);

    void SetSubmitHandler(SubmitHandler handler);
    void SetCancelHandler(CancelHandler handler);
    void SetValidationErrorHandler(ValidationErrorHandler handler);
    void SetVisibilityChangedHandler(VisibilityChangedHandler handler);
    void SetCandidatesRequestHandler(CandidatesRequestHandler handler);

    void ShowPrompt(const domain::GamePrompt& prompt, domain::GameAction action);
    void HidePrompt(bool clearSignature = false);
    void ApplyCandidates(const domain::GameActionCandidatesResult& result);
    void RejectCandidatesRequest();
    [[nodiscard]] bool IsActive() const;
    [[nodiscard]] bool HandleKey(wxKeyEvent& event);
    [[nodiscard]] std::vector<wxWindow*> TabTargets() const;

private:
    struct FieldControl final
    {
        domain::GamePromptField field;
        wxTextCtrl* text = nullptr;
        wxCheckBox* checkbox = nullptr;
        wxChoice* choice = nullptr;
        wxCheckListBox* multipleChoice = nullptr;
        wxRearrangeCtrl* ordering = nullptr;
    };

    void BuildLayout();
    void RebuildFields(const domain::GamePrompt& prompt);
    void Submit();
    void Cancel();
    void FocusFirst();
    void RequestCandidates(bool reset);
    [[nodiscard]] static std::string BuildSignature(const domain::GamePrompt& prompt);

    wxStaticText* title_ = nullptr;
    wxSizer* fieldsSizer_ = nullptr;
    wxStaticText* candidatesLabel_ = nullptr;
    wxTextCtrl* candidatesQuery_ = nullptr;
    wxButton* candidatesSearchButton_ = nullptr;
    wxListBox* candidatesList_ = nullptr;
    wxButton* candidatesMoreButton_ = nullptr;
    wxButton* cancelButton_ = nullptr;
    wxButton* submitButton_ = nullptr;
    std::vector<FieldControl> fields_;
    std::optional<domain::GameAction> action_;
    std::string cancelActionType_;
    std::string signature_;
    bool paginatedCandidates_ = false;
    bool candidatesRequestPending_ = false;
    std::optional<int> nextCandidatesOffset_;
    std::vector<domain::GameAction> candidates_;
    SubmitHandler onSubmit_;
    CancelHandler onCancel_;
    ValidationErrorHandler onValidationError_;
    VisibilityChangedHandler onVisibilityChanged_;
    CandidatesRequestHandler onCandidatesRequest_;
};
}
