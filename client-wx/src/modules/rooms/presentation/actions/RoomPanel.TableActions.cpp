#include "modules/rooms/presentation/shell/RoomPanel.h"

#include <memory>
#include <algorithm>

#include <wx/choicdlg.h>
#include <wx/numdlg.h>
#include <wx/weakref.h>

#include "modules/audio/application/IAudioService.h"
#include "modules/gameplay/shell/presentation/panel/GamePlayPanel.h"
#include "modules/rooms/application/RoomLobbyService.h"
#include "modules/rooms/application/RoomSessionService.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::rooms::presentation
{
void RoomPanel::ShowRules()
{
    gamePlayPanel_->ShowRules();
    UpdateStatus(wxString(L"Chargement des règles..."));
}

void RoomPanel::ConfigureAmbience()
{
    CancelRequest();
    state_ = State::Busy;
    auto result = std::make_shared<std::vector<domain::TableAmbience>>();
    auto* service = &roomLobbyService_;
    const auto generation = requestSlot_.CurrentToken();
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, result](std::stop_token token)
        { *result = service->ListTableAmbiences(token); },
        [weakThis, generation, result](std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakThis) return;
            weakThis->CallAfter([weakThis, generation, result, error = std::move(error)]() mutable
            {
                if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                weakThis->state_ = State::Ready;
                if (error)
                {
                    weakThis->UpdateStatus(
                        lila::shared::text::FromUtf8(error->UserMessage()), true, true);
                    return;
                }
                wxArrayString labels;
                labels.Add(wxString(L"Silence (aucune ambiance)"));
                int selected = 0;
                for (std::size_t index = 0; index < result->size(); ++index)
                {
                    labels.Add(lila::shared::text::FromUtf8((*result)[index].name));
                    if ((*result)[index].soundId == weakThis->room_.tableAmbienceSoundId)
                        selected = static_cast<int>(index + 1);
                }
                wxSingleChoiceDialog dialog(weakThis,
                    wxString(L"Choisissez une ambiance publiée par le serveur."),
                    wxString(L"Ambiance de table"), labels);
                dialog.SetSelection(selected);
                if (dialog.ShowModal() != wxID_OK) return;
                const int choice = dialog.GetSelection();
                const std::string soundId = choice <= 0 ? std::string{}
                    : (*result)[static_cast<std::size_t>(choice - 1)].soundId;
                weakThis->ExecuteCommand(
                    {domain::RoomCommand::SetAmbience, false, soundId});
            });
        }));
}

void RoomPanel::ConfigureAmbienceVolume()
{
    const long value = wxGetNumberFromUser(
        wxString(L"Volume local de l’ambiance, de 0 à 100."),
        wxString(L"Volume"), wxString(L"Ambiance de table"),
        ambienceVolume_, 0, 100, this);
    if (value < 0) return;
    ambienceVolume_ = static_cast<int>(value);
    audioService_.SetTableAmbienceVolume(ambienceVolume_);
    UpdateStatus(wxString::Format(L"Volume de l’ambiance : %d %%.", ambienceVolume_), false, true);
}

void RoomPanel::ModeratePlayer(bool ban)
{
    std::vector<domain::RoomMember> candidates;
    const int selfId = currentUserId_ ? currentUserId_() : 0;
    const auto append = [&candidates, selfId, this](const auto& members)
    {
        for (const auto& member : members)
            if (member.id != selfId && member.id != room_.ownerId)
                candidates.push_back(member);
    };
    append(room_.players);
    append(room_.spectators);
    if (candidates.empty())
    {
        UpdateStatus(wxString(L"Aucun joueur ne peut être ciblé."), true, true);
        return;
    }
    wxArrayString labels;
    for (const auto& member : candidates)
        labels.Add(lila::shared::text::FromUtf8(member.name));
    wxSingleChoiceDialog dialog(this,
        ban ? wxString(L"Choisissez le joueur à bannir.")
            : wxString(L"Choisissez le joueur à exclure."),
        ban ? wxString(L"Bannir") : wxString(L"Exclure"), labels);
    if (dialog.ShowModal() != wxID_OK) return;
    const int selected = dialog.GetSelection();
    if (selected < 0 || static_cast<std::size_t>(selected) >= candidates.size()) return;
    ExecuteCommand({ban ? domain::RoomCommand::Ban : domain::RoomCommand::Kick,
        false, {}, candidates[static_cast<std::size_t>(selected)].id});
}

void RoomPanel::TransferOwnership()
{
    std::vector<domain::RoomMember> candidates;
    const auto append = [&candidates, this](const auto& members)
    {
        for (const auto& member : members)
            if (member.id > 0 && member.id != room_.ownerId) candidates.push_back(member);
    };
    append(room_.players);
    append(room_.spectators);
    if (candidates.empty())
    {
        UpdateStatus(wxString(L"Aucun membre ne peut devenir propriétaire."), true, true);
        return;
    }
    wxArrayString labels;
    for (const auto& member : candidates)
        labels.Add(lila::shared::text::FromUtf8(member.name));
    wxSingleChoiceDialog dialog(this, wxString(L"Nouveau propriétaire"),
        wxString(L"Transférer la propriété"), labels);
    if (dialog.ShowModal() != wxID_OK) return;
    const int selected = dialog.GetSelection();
    if (selected < 0 || static_cast<std::size_t>(selected) >= candidates.size()) return;
    ExecuteCommand({domain::RoomCommand::SetOwner, false, {},
        candidates[static_cast<std::size_t>(selected)].id});
}

void RoomPanel::InvitePlayer()
{
    CancelRequest();
    state_ = State::Busy;
    auto result = std::make_shared<std::vector<domain::RoomInviteCandidate>>();
    auto* service = &roomLobbyService_;
    const int roomId = room_.id;
    const auto generation = requestSlot_.CurrentToken();
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, roomId, result](std::stop_token token)
        { *result = service->ListInviteCandidates(roomId, token); },
        [weakThis, generation, result](std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakThis) return;
            weakThis->CallAfter([weakThis, generation, result, error = std::move(error)]() mutable
            {
                if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                weakThis->state_ = State::Ready;
                if (error) { weakThis->UpdateStatus(
                    lila::shared::text::FromUtf8(error->UserMessage()), true, true); return; }
                wxArrayString labels;
                for (const auto& candidate : *result)
                    labels.Add(lila::shared::text::FromUtf8(candidate.username +
                        (candidate.pendingInvite ? " (déjà invité)" : "")));
                if (labels.empty()) { weakThis->UpdateStatus(
                    wxString(L"Aucun utilisateur disponible à inviter."), false, true); return; }
                wxSingleChoiceDialog dialog(weakThis, wxString(L"Utilisateur à inviter"),
                    wxString(L"Invitation"), labels);
                if (dialog.ShowModal() != wxID_OK) return;
                const int choice = dialog.GetSelection();
                if (choice < 0 || static_cast<std::size_t>(choice) >= result->size()) return;
                const int userId = (*result)[static_cast<std::size_t>(choice)].id;
                weakThis->SendInvite(userId);
            });
        }));
}

void RoomPanel::SendInvite(int userId)
{
    CancelRequest();
    state_ = State::Busy;
    auto* service = &roomLobbyService_;
    const int roomId = room_.id;
    const auto generation = requestSlot_.CurrentToken();
    wxWeakRef<RoomPanel> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync(
        [service, roomId, userId](std::stop_token token)
        { service->SendInvite(roomId, userId, token); },
        [weakThis, generation](std::optional<lila::shared::errors::AppError> error)
        {
            if (!weakThis) return;
            weakThis->CallAfter([weakThis, generation, error = std::move(error)]() mutable
            {
                if (!weakThis || !weakThis->requestSlot_.Complete(generation)) return;
                weakThis->state_ = State::Ready;
                if (error) weakThis->UpdateStatus(
                    lila::shared::text::FromUtf8(error->UserMessage()), true, true);
                else
                {
                    weakThis->audioService_.Play(
                        lila::modules::audio::domain::SoundCue::InvitationSent);
                    weakThis->UpdateStatus(wxString(L"Invitation envoyée."), false, true);
                }
            });
        }));
}
}
