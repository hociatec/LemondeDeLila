#include "modules/gameplay/workflows/presentation/GameWorkflowPanel.h"

#include <algorithm>

#include <wx/listbox.h>
#include <wx/sizer.h>

#include "modules/gameplay/information/application/GameValueTextBuilder.h"
#include "modules/gameplay/shell/presentation/formatting/GamePlayFormatters.h"

namespace lila::modules::gameplay::presentation::workflows
{
namespace
{
std::string Player(const domain::GameState& state, int id)
{
    const auto found = std::find_if(state.system.players.begin(), state.system.players.end(),
        [id](const domain::GamePlayer& player) { return player.id == id; });
    return found == state.system.players.end() ? "Joueur " + std::to_string(id) : found->username;
}

std::string SubmissionValue(
    const domain::GameState& state, const domain::GameSubmissionValue& value)
{
    if (value.kind == domain::GameSubmissionValueKind::Player && value.playerId)
        return Player(state, *value.playerId);
    if (!value.label.empty()) return value.label;
    if (!value.text.empty()) return value.text;
    if (!value.id.empty()) return application::info::HumanLabel(value.id);
    if (value.number) return std::to_string(*value.number);
    if (value.boolean) return *value.boolean ? "oui" : "non";
    return {};
}
}

GameWorkflowPanel::GameWorkflowPanel(wxWindow* parent) : wxPanel(parent)
{
    auto* layout = new wxBoxSizer(wxVERTICAL);
    rows_ = new wxListBox(this, wxID_ANY, wxDefaultPosition, wxDefaultSize,
        0, nullptr, wxLB_SINGLE | wxWANTS_CHARS);
    rows_->SetName(wxString(L"Quiz, collections et soumissions. Consultation navigable."));
    layout->Add(rows_, 1, wxEXPAND);
    SetSizer(layout);
    Hide();
}

void GameWorkflowPanel::Apply(const domain::GameState& state)
{
    const auto previousKey = SelectedKey();
    std::vector<std::string> nextKeys;
    std::vector<std::string> nextLabels;
    const auto append = [&nextKeys, &nextLabels](std::string key, std::string label)
    {
        nextKeys.push_back(std::move(key));
        nextLabels.push_back(std::move(label));
    };
    const auto appendSection = [&append](std::string key, std::string label)
    {
        append("section:" + std::move(key), "— " + std::move(label) + " —");
    };
    if (state.kits.quiz && !state.kits.quiz->sessions.empty())
    {
        appendSection("quiz", "Quiz");
        for (const auto& session : state.kits.quiz->sessions)
        {
            append("quiz:" + session.id + ":prompt", "Quiz : " + session.prompt + " — " +
                application::info::HumanLabel(session.phase));
            for (std::size_t index = 0; index < session.choices.size(); ++index)
            {
                append("quiz:" + session.id + ":choice:" + std::to_string(index),
                    std::to_string(index + 1) + ". " + session.choices[index] +
                    (session.correctAnswerIndex == static_cast<int>(index) ? " — réponse correcte" : ""));
            }
        }
    }
    if (state.kits.submissions &&
        (!state.kits.submissions->sessions.empty() || !state.kits.submissions->judges.empty()))
    {
        appendSection("submissions", "Soumissions");
        for (const auto& session : state.kits.submissions->sessions)
        {
            append("submission:" + session.id + ":status",
                application::info::HumanLabel(session.kind) + " " + session.id +
                (session.revealed ? " — révélée" : session.closed ? " — fermée" : " — ouverte"));
            for (const int id : session.pendingPlayerIds)
            {
                append("submission:" + session.id + ":pending:" + std::to_string(id),
                    "En attente de " + Player(state, id));
            }
            for (const int id : session.submittedPlayerIds)
            {
                append("submission:" + session.id + ":submitted:" + std::to_string(id),
                    Player(state, id) + " a soumis");
            }
            for (const auto& [id, value] : session.visibleValues)
            {
                append("submission:" + session.id + ":value:" + std::to_string(id),
                    Player(state, id) + " : " + SubmissionValue(state, value));
            }
            if (session.ownValue)
            {
                append("submission:" + session.id + ":own",
                    "Votre soumission : " + SubmissionValue(state, *session.ownValue));
            }
        }
        for (const auto& judge : state.kits.submissions->judges)
            if (judge.playerId)
            {
                append("judge:" + judge.id, "Juge : " + Player(state, *judge.playerId));
            }
    }
    if (state.kits.collections && !state.kits.collections->players.empty())
    {
        appendSection("collections", "Collections");
        for (const auto& collection : state.kits.collections->players)
        {
            append("collection:" + collection.collectionId + ":" +
                std::to_string(collection.playerId), Player(state, collection.playerId) + ", " +
                application::info::HumanLabel(collection.collectionId) +
                " : total " + std::to_string(collection.total));
            for (const auto& group : collection.groups)
            {
                append("collection:" + collection.collectionId + ":" +
                    std::to_string(collection.playerId) + ":" + group.id,
                    "- " + application::info::HumanLabel(group.id) +
                    " : " + std::to_string(group.count));
            }
        }
    }
    if (nextKeys == rowKeys_ && nextLabels == rowLabels_) return;
    rows_->Clear();
    rowKeys_ = std::move(nextKeys);
    rowLabels_ = std::move(nextLabels);
    for (const auto& label : rowLabels_) rows_->Append(FromUtf8(label));
    if (rows_->GetCount() > 0)
    {
        const auto found = std::find(rowKeys_.begin(), rowKeys_.end(), previousKey);
        rows_->SetSelection(found == rowKeys_.end() ? 0
            : static_cast<int>(std::distance(rowKeys_.begin(), found)));
    }
    Show(rows_->GetCount() > 0);
}

void GameWorkflowPanel::Clear()
{
    rowKeys_.clear(); rowLabels_.clear(); rows_->Clear(); Hide();
}
std::string GameWorkflowPanel::SelectedKey() const
{
    const int selection = rows_->GetSelection();
    return selection < 0 || static_cast<std::size_t>(selection) >= rowKeys_.size()
        ? std::string{} : rowKeys_[static_cast<std::size_t>(selection)];
}
wxWindow* GameWorkflowPanel::NavigationTarget() const
{
    return IsShown() && rows_->GetCount() > 0 ? rows_ : nullptr;
}
}
