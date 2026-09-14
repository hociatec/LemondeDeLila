#include "modules/admin/presentation/AdminFrame.h"

#include <utility>
#include <memory>

#include <nlohmann/json.hpp>
#include <wx/filedlg.h>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/textdlg.h>
#include <wx/weakref.h>

#include "modules/admin/application/AdminService.h"
#include "modules/admin/presentation/AdminCommandDialog.h"
#include "modules/admin/presentation/AdminResultFormatter.h"
#include "shared/concurrency/application/BackgroundExecutor.h"
#include "shared/security/infrastructure/SecurityUtils.h"
#include "shared/security/domain/SensitiveString.h"
#include "shared/text/presentation/encoding/Encoding.h"

namespace lila::modules::admin::presentation
{
void AdminFrame::ActivateCommand(std::size_t commandIndex)
{
    if (loading_ || commandIndex >= visibleCommands_.size()) return;
    const auto& command = *visibleCommands_[commandIndex];
    nlohmann::json payload;
    try
    {
        payload = nlohmann::json::parse(command.payloadTemplate);
    }
    catch (...)
    {
        SetStatus(wxString(L"Le modèle de requête est invalide."), true);
        return;
    }
    if (!PreparePayload(command, payload) || !ConfirmDangerous(command)) return;
    if (command.transport == domain::AdminTransport::LocalAction)
    {
        int roomId = 0;
        bool spectator = false;
        try
        {
            roomId = payload.value("roomId", 0);
            spectator = payload.value("spectator", false);
        }
        catch (...)
        {
            SetStatus(wxString(L"Les paramètres de salle ont un type invalide."), true);
            return;
        }
        if (roomId <= 0)
        {
            SetStatus(wxString(L"Identifiant de salle invalide."), true);
            return;
        }
        if (onJoinRoomRequested_)
            onJoinRoomRequested_(roomId, spectator);
        return;
    }
    if (command.maintenanceToken && !EnsureMaintenanceToken()) return;
    ExecuteCommand(command, std::move(payload));
}

bool AdminFrame::PreparePayload(
    const domain::AdminCommand& command,
    nlohmann::json& payload)
{
    const bool needsInput = command.payloadTemplate != "{}";
    if (needsInput)
    {
        AdminCommandDialog dialog(this, command, payload);
        if (dialog.ShowModal() != wxID_OK) return false;
        payload = dialog.Payload();
    }

    bool needsFile = false;
    if (command.transport == domain::AdminTransport::HttpMultipart)
    {
        const auto filePath = payload.find("filePath");
        if (filePath != payload.end() && !filePath->is_string())
        {
            SetStatus(wxString(L"Le chemin du fichier doit être une chaîne de caractères."), true);
            return false;
        }
        needsFile = filePath == payload.end() || filePath->get<std::string>().empty();
    }
    if (needsFile)
    {
        wxFileDialog picker(
            this, wxString(L"Choisir un fichier audio"), wxString{}, wxString{},
            wxString(L"Fichiers audio (*.wav;*.mp3)|*.wav;*.mp3|Tous les fichiers|*.*"),
            wxFD_OPEN | wxFD_FILE_MUST_EXIST);
        if (picker.ShowModal() != wxID_OK) return false;
        payload["filePath"] = lila::shared::text::ToUtf8(picker.GetPath());
    }
    return true;
}

bool AdminFrame::ConfirmDangerous(const domain::AdminCommand& command)
{
    if (!command.dangerous) return true;
    if (wxMessageBox(
            wxString(L"Cette opération modifie des données sensibles. Voulez-vous continuer ?"),
            wxString(command.label), wxYES_NO | wxNO_DEFAULT | wxICON_WARNING,
            this) != wxYES)
        return false;
    wxTextEntryDialog confirmation(
        this, wxString(L"Saisissez CONFIRMER pour exécuter l'opération."),
        wxString(L"Confirmation renforcée"));
    return confirmation.ShowModal() == wxID_OK && confirmation.GetValue() == L"CONFIRMER";
}

bool AdminFrame::EnsureMaintenanceToken()
{
    if (maintenanceTokenInitialized_) return true;
    wxPasswordEntryDialog dialog(
        this,
        wxString(L"Saisissez le token de maintenance. Laissez vide si ce serveur n'en exige pas. Il restera uniquement en mémoire jusqu'à la fermeture de la console."),
        wxString(L"Token de maintenance"));
    if (dialog.ShowModal() != wxID_OK) return false;
    maintenanceToken_ = lila::shared::text::ToUtf8(dialog.GetValue());
    maintenanceTokenInitialized_ = true;
    return true;
}

void AdminFrame::ExecuteCommand(
    const domain::AdminCommand& command,
    nlohmann::json payload)
{
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    loading_ = true;
    SetStatus(wxString(L"Opération en cours…"));
    auto* service = &service_;
    const auto* commandPointer = &command;
    const auto maintenanceToken =
        std::make_shared<lila::shared::security::SensitiveString>(maintenanceToken_);
    wxWeakRef<AdminFrame> weakThis(this);
    requestSlot_.Track(lila::shared::concurrency::RunAsync<nlohmann::json>(
        [service, commandPointer, payload = std::move(payload), maintenanceToken](std::stop_token stopToken)
        {
            return service->Execute(
                *commandPointer, payload, maintenanceToken->Value(), stopToken);
        },
        [weakThis, generation, commandPointer](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<nlohmann::json> result) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, commandPointer, error = std::move(error),
                 result = std::move(result)]() mutable
                {
                    if (weakThis)
                        weakThis->CompleteCommand(
                            generation, *commandPointer, std::move(error), std::move(result));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::High,
        "Opération administrateur impossible."));
}

void AdminFrame::CompleteCommand(
    lila::shared::concurrency::AsyncRequestSlot::Token generation,
    const domain::AdminCommand& command,
    std::optional<lila::shared::errors::AppError> error,
    std::optional<nlohmann::json> result)
{
    if (!requestSlot_.Complete(generation)) return;
    loading_ = false;
    if (error.has_value() || !result.has_value())
    {
        SetStatus(lila::shared::text::FromUtf8(
            error ? error->UserMessage() : "Réponse administrateur absente."), true);
        FocusCurrentMenu();
        return;
    }
    const auto temporaryPassword = result->find("temporaryPassword");
    if (temporaryPassword != result->end() && temporaryPassword->is_string())
    {
        lila::shared::security::SensitiveString password(
            temporaryPassword->get<std::string>());
        wxTextEntryDialog passwordDialog(
            this,
            wxString(L"Copiez ce mot de passe maintenant. Il ne sera plus affiché après la fermeture de cette boîte de dialogue."),
            wxString(L"Mot de passe temporaire"),
            lila::shared::text::FromUtf8(password.Value()),
            wxOK);
        passwordDialog.ShowModal();
        *temporaryPassword = "<affiché une seule fois>";
    }
    resultText_->SetValue(lila::shared::text::FromUtf8(FormatAdminResult(*result)));
    SetStatus(wxString(L"Opération terminée : ") + wxString(command.label));
    FocusResult();
}
}
