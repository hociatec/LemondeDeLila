#include "modules/gameplay/prompts/presentation/GamePromptPanel.h"

#include <algorithm>
#include <sstream>
#include <utility>

#include <wx/button.h>
#include <wx/listbox.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>

#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"
#include "modules/gameplay/state/application/GameValuePayloadCodec.h"

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
            signature << ':' << application::EncodeGameValuePayload(choice).dump();
    return signature.str();
}

bool GamePromptPanel::ShowPrompt(const domain::GamePrompt& prompt, domain::GameAction action)
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
    return !wasActive || fieldsChanged;
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
    request.query.emplace("context", domain::GameValue{action_->payload});
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
        const auto duplicate = std::find_if(candidates_.begin(), candidates_.end(),
            [&candidate](const domain::GameAction& existing)
            { return existing.type == candidate.type && existing.payload == candidate.payload; });
        if (duplicate != candidates_.end()) continue;
        candidates_.push_back(candidate);
        candidatesList_->Append(FromUtf8(
            candidate.label.empty()
                ? PanelGameValueToDisplay(domain::GameValue{candidate.payload})
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
