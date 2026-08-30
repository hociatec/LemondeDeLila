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
    Clear();
    if (state.kits.quiz)
        for (const auto& session : state.kits.quiz->sessions)
        {
            rows_->Append(FromUtf8("Quiz : " + session.prompt + " — " +
                application::info::HumanLabel(session.phase)));
            for (std::size_t index = 0; index < session.choices.size(); ++index)
                rows_->Append(FromUtf8(std::to_string(index + 1) + ". " + session.choices[index] +
                    (session.correctAnswerIndex == static_cast<int>(index) ? " — réponse correcte" : "")));
        }
    if (state.kits.submissions)
        for (const auto& session : state.kits.submissions->sessions)
        {
            rows_->Append(FromUtf8(application::info::HumanLabel(session.kind) + " " + session.id +
                (session.revealed ? " — révélée" : session.closed ? " — fermée" : " — ouverte")));
            for (const int id : session.pendingPlayerIds)
                rows_->Append(FromUtf8("En attente de " + Player(state, id)));
            for (const int id : session.submittedPlayerIds)
                rows_->Append(FromUtf8(Player(state, id) + " a soumis"));
        }
    if (state.kits.collections)
        for (const auto& collection : state.kits.collections->players)
        {
            rows_->Append(FromUtf8(Player(state, collection.playerId) + ", " +
                application::info::HumanLabel(collection.collectionId) +
                " : total " + std::to_string(collection.total)));
            for (const auto& group : collection.groups)
                rows_->Append(FromUtf8("- " + application::info::HumanLabel(group.id) +
                    " : " + std::to_string(group.count)));
        }
    if (rows_->GetCount() > 0) rows_->SetSelection(0);
    Show(rows_->GetCount() > 0);
}

void GameWorkflowPanel::Clear() { rows_->Clear(); Hide(); }
wxWindow* GameWorkflowPanel::NavigationTarget() const
{
    return IsShown() && rows_->GetCount() > 0 ? rows_ : nullptr;
}
}
