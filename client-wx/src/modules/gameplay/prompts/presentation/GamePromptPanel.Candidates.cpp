#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

#include <algorithm>
#include <sstream>
#include <utility>

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/state/infrastructure/GameValueDecoder.h"

namespace lila::modules::gameplay::presentation::prompt
{
std::string GamePromptPanel::BuildSignature(const domain::GamePrompt& prompt)
{
    std::ostringstream signature;
    signature << prompt.actionType << "|remote:" << prompt.paginatedCandidates;
    for (const auto& field : prompt.fields)
        signature << '|' << field.key << ':' << field.kind << ':' << field.initialText
                  << ':' << field.multiple << ':' << field.ordering;
    for (const auto& field : prompt.fields)
        for (const auto& choice : field.choices)
            signature << ':' << infrastructure::EncodeGameValue(choice).dump();
    return signature.str();
}

void GamePromptPanel::ShowPrompt(const domain::GamePrompt& prompt, domain::GameAction action)
{
    const bool wasActive = IsActive();
    action_ = std::move(action);
    paginatedCandidates_ = prompt.paginatedCandidates;
    cancelActionType_ = prompt.cancelActionType;
    const auto nextSignature = BuildSignature(prompt);
    const bool fieldsChanged = signature_ != nextSignature;
    if (fieldsChanged)
    {
        signature_ = nextSignature;
        candidates_.clear();
        candidatesList_->Clear();
        nextCandidatesOffset_.reset();
        candidatesRequestPending_ = false;
        RebuildFields(prompt);
    }

    const auto title = prompt.title.empty() ? prompt.label : prompt.title;
    title_->SetLabel(FromUtf8(title.empty() ? std::string("Configuration") : title));
    candidatesLabel_->Show(paginatedCandidates_);
    candidatesQuery_->Show(paginatedCandidates_);
    candidatesSearchButton_->Show(paginatedCandidates_);
    candidatesList_->Show(paginatedCandidates_);
    candidatesMoreButton_->Show(paginatedCandidates_ && nextCandidatesOffset_.has_value());
    Show();
    if (!wasActive && onVisibilityChanged_) onVisibilityChanged_(true);
    Layout();
    if (paginatedCandidates_ && candidates_.empty()) RequestCandidates(true);
    if (!wasActive || fieldsChanged) FocusFirst();
}

void GamePromptPanel::RequestCandidates(bool reset)
{
    if (!paginatedCandidates_ || !action_ || !onCandidatesRequest_ ||
        candidatesRequestPending_)
        return;
    domain::GameActionCandidatesRequest request;
    request.actionType = action_->type;
    request.offset = reset ? 0 : nextCandidatesOffset_.value_or(0);
    const auto search = std::string(candidatesQuery_->GetValue().ToUTF8().data());
    if (!search.empty()) request.query.emplace("search", domain::GameValue{search});
    request.query.emplace("context", infrastructure::DecodeGameValue(action_->payload));
    if (reset)
    {
        candidates_.clear();
        candidatesList_->Clear();
        nextCandidatesOffset_.reset();
    }
    candidatesRequestPending_ = true;
    candidatesMoreButton_->Disable();
    onCandidatesRequest_(std::move(request));
}

void GamePromptPanel::ApplyCandidates(const domain::GameActionCandidatesResult& result)
{
    if (!IsActive() || !action_ || result.actionType != action_->type) return;
    candidatesRequestPending_ = false;
    if (result.offset == 0)
    {
        candidates_.clear();
        candidatesList_->Clear();
    }
    for (const auto& candidate : result.items)
    {
        const auto identity = candidate.type + "|" + candidate.payload.dump();
        const auto duplicate = std::find_if(candidates_.begin(), candidates_.end(),
            [&identity](const domain::GameAction& existing)
            { return existing.type + "|" + existing.payload.dump() == identity; });
        if (duplicate != candidates_.end()) continue;
        candidates_.push_back(candidate);
        candidatesList_->Append(FromUtf8(
            candidate.label.empty()
                ? PanelJsonToDisplay(candidate.payload)
                : candidate.label));
    }
    nextCandidatesOffset_ = result.nextOffset;
    if (candidatesList_->GetCount() > 0 && candidatesList_->GetSelection() == wxNOT_FOUND)
        candidatesList_->SetSelection(0);
    candidatesMoreButton_->Enable();
    candidatesMoreButton_->Show(nextCandidatesOffset_.has_value());
    Layout();
}

void GamePromptPanel::RejectCandidatesRequest()
{
    candidatesRequestPending_ = false;
    candidatesMoreButton_->Enable();
}
}
