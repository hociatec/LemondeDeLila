#include "modules/presence/presentation/PresenceFrame.h"

#include <memory>
#include <utility>

#include <wx/msgdlg.h>
#include <wx/stattext.h>
#include <wx/textctrl.h>
#include <wx/textdlg.h>
#include <wx/weakref.h>

#include "modules/presence/presentation/PresenceActionController.h"
#include "modules/social/domain/SocialProfile.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::presence::presentation
{
namespace
{
wxString FromUtf8(const std::string& value)
{
    return lila::shared::text::FromUtf8(value);
}

std::string ToUtf8(const wxString& value)
{
    return value.ToUTF8().data();
}
}

void PresenceFrame::LoadSocialState(int userId)
{
    auto result = std::make_shared<PresenceSocialState>();
    activeTask_ = lila::shared::concurrency::RunAsync(
        [this, userId, result]()
        {
            *result = actionController_->LoadSocialState(userId);
        },
        [this, result](std::optional<lila::shared::errors::AppError> error)
        {
            wxWeakRef<PresenceFrame> weakThis(this);
            CallAfter(
                [weakThis, result, error = std::move(error)]() mutable
                {
                    if (!weakThis)
                    {
                        return;
                    }
                    if (error.has_value())
                    {
                        const auto previousId = weakThis->selectedPlayer_.has_value()
                            ? std::optional<int>{weakThis->selectedPlayer_->id}
                            : std::nullopt;
                        weakThis->busy_ = false;
                        weakThis->page_ = Page::Players;
                        weakThis->selectedPlayer_.reset();
                        weakThis->socialState_.reset();
                        weakThis->RebuildPlayers(previousId, true);
                        weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true);
                        return;
                    }
                    weakThis->busy_ = false;
                    weakThis->socialState_ = *result;
                    weakThis->RebuildActions();
                });
        });
}

void PresenceFrame::RunSelectedAction()
{
    if (!selectedPlayer_.has_value())
    {
        return;
    }
    const auto action = SelectedActionId();
    const int userId = selectedPlayer_->id;
    const wxString username = FromUtf8(selectedPlayer_->username);

    if (action == "bio")
    {
        ShowBio(userId, username);
        return;
    }
    if (action == "storybook")
    {
        if (onOpenStoryBookRequested_)
        {
            onOpenStoryBookRequested_(userId, selectedPlayer_->username);
        }
        return;
    }
    if (action == "message")
    {
        SendPrivateMessage(userId, username);
        return;
    }

    auto worker = [this, action, userId]() { actionController_->ExecuteSocialAction(action, userId); };
    RunSocialMutation(wxString(L"Action sociale en cours..."), std::move(worker), [this, userId]() { LoadSocialState(userId); });
}

void PresenceFrame::RunSocialMutation(const wxString& busyMessage, std::function<void()> worker, std::function<void()> onSuccess)
{
    busy_ = true;
    UpdateStatus(busyMessage);
    activeTask_ = lila::shared::concurrency::RunAsync(
        std::move(worker),
        [this, onSuccess = std::move(onSuccess)](std::optional<lila::shared::errors::AppError> error)
        {
            wxWeakRef<PresenceFrame> weakThis(this);
            CallAfter(
                [weakThis, error = std::move(error), onSuccess]() mutable
                {
                    if (!weakThis)
                    {
                        return;
                    }
                    weakThis->busy_ = false;
                    if (error.has_value())
                    {
                        weakThis->UpdateStatus(FromUtf8(error->UserMessage()), true);
                        return;
                    }
                    weakThis->UpdateStatus(wxString(L"Action effectuee."));
                    if (onSuccess)
                    {
                        onSuccess();
                    }
                });
        });
}

void PresenceFrame::ShowBio(int userId, const wxString& username)
{
    auto profile = std::make_shared<std::optional<lila::modules::social::domain::SocialProfile>>();
    RunSocialMutation(
        wxString(L"Chargement de la bio..."),
        [this, userId, profile]() { *profile = actionController_->LoadBio(userId); },
        [this, profile, username]()
        {
            if (!profile->has_value())
            {
                wxMessageBox(wxString(L"Profil indisponible."), wxString(L"Bio"), wxOK | wxICON_INFORMATION, this);
                return;
            }
            const auto& value = **profile;
            if (!value.isOwner && !value.canView)
            {
                wxMessageBox(wxString(L"Bio indisponible."), wxString(L"Bio"), wxOK | wxICON_INFORMATION, this);
                return;
            }
            wxString bio = value.bio.empty() ? wxString(L"(vide)") : FromUtf8(value.bio);
            wxMessageBox(bio, wxString(L"Bio - ") + username, wxOK | wxICON_INFORMATION, this);
        });
}

void PresenceFrame::SendPrivateMessage(int userId, const wxString& username)
{
    wxTextEntryDialog subjectDialog(this, wxString(L"Sujet"), wxString(L"Message a ") + username);
    if (subjectDialog.ShowModal() != wxID_OK)
    {
        return;
    }
    wxTextEntryDialog bodyDialog(this, wxString(L"Message"), wxString(L"Message a ") + username, wxEmptyString, wxTextEntryDialogStyle | wxTE_MULTILINE);
    if (bodyDialog.ShowModal() != wxID_OK)
    {
        return;
    }
    const auto subject = ToUtf8(subjectDialog.GetValue());
    const auto body = ToUtf8(bodyDialog.GetValue());
    RunSocialMutation(
        wxString(L"Envoi du message..."),
        [this, userId, subject, body]() { actionController_->SendPrivateMessage(userId, subject, body); },
        [this]() { detailsLabel_->SetLabel(wxString(L"Message envoye.")); });
}
}
