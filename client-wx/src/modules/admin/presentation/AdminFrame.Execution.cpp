#include "modules/admin/presentation/AdminFrame.h"

#include <utility>
#include <memory>
#include <nlohmann/json.hpp>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/textdlg.h>
#include <wx/weakref.h>
#include "modules/admin/application/AdminService.h"
#include "modules/admin/domain/AdminPagination.h"
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
    if (command.id == "bugs.list")
    {
        reportSearchCtrl_->SetFocus();
        SetStatus(wxString(L"Saisissez votre recherche puis appuyez sur Entrée. Laissez vide pour tout afficher."));
        return;
    }
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
    if (showingItemActions_)
    {
        ApplyContextToPayload(command, payload);
        if (commandIndex < contextActionPayloads_.size())
            for (const auto& item : contextActionPayloads_[commandIndex].items())
                payload[item.key()] = item.value();
        if (command.id == "bugs.get")
        {
            FocusResultDetails();
            return;
        }
    }
    const bool direct = showingItemActions_ &&
        commandIndex < contextActionDirect_.size() && contextActionDirect_[commandIndex];
    if ((!direct && !PreparePayload(command, payload)) || !ConfirmDangerous(command)) return;
    if (command.transport == domain::AdminTransport::LocalAction)
    {
        if (command.operation == "preview-sound")
        {
            const auto soundId = payload.value("soundId", std::string{});
            if (soundId.empty()) SetStatus(wxString(L"Identifiant du son absent."), true);
            else PreviewSound(soundId);
            return;
        }
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
    refreshAreaAfterCommand_ = showingItemActions_ && ContextCommandMutates(command);
    if (command.maintenanceToken && !EnsureMaintenanceToken())
    {
        refreshAreaAfterCommand_ = false;
        return;
    }
    ExecuteCommand(command, std::move(payload));
}

bool AdminFrame::EnsureMaintenanceToken()
{
    if (maintenanceTokenInitialized_) return true;
    wxPasswordEntryDialog dialog(
        this,
        wxString(L"Saisissez le jeton de maintenance. Laissez vide si ce serveur n'en exige pas. Il restera uniquement en mémoire jusqu'à la fermeture de la console."),
        wxString(L"Jeton de maintenance"));
    if (dialog.ShowModal() != wxID_OK) return false;
    maintenanceToken_ = lila::shared::text::ToUtf8(dialog.GetValue());
    maintenanceTokenInitialized_ = true;
    return true;
}

void AdminFrame::ExecuteCommand(
    const domain::AdminCommand& command,
    nlohmann::json payload,
    bool announceLifecycle)
{
    if (command.id == "bugs.list") bugReportListPayload_ = payload;
    ResetPagination(command, payload);
    requestSlot_.Cancel();
    const auto generation = requestSlot_.CurrentToken();
    loading_ = true;
    if (announceLifecycle)
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
        [weakThis, generation, commandPointer, announceLifecycle](
            std::optional<lila::shared::errors::AppError> error,
            std::optional<nlohmann::json> result) mutable
        {
            if (!weakThis) return;
            weakThis->CallAfter(
                [weakThis, generation, commandPointer, announceLifecycle,
                 error = std::move(error),
                 result = std::move(result)]() mutable
                {
                    if (weakThis)
                        weakThis->CompleteCommand(
                            generation,
                            *commandPointer,
                            announceLifecycle,
                            std::move(error),
                            std::move(result));
                });
        },
        lila::shared::concurrency::BackgroundTaskPriority::High,
        "Opération administrateur impossible."));
}

void AdminFrame::CompleteCommand(
    lila::shared::concurrency::AsyncRequestSlot::Token generation,
    const domain::AdminCommand& command,
    bool announceLifecycle,
    std::optional<lila::shared::errors::AppError> error,
    std::optional<nlohmann::json> result)
{
    if (!requestSlot_.Complete(generation)) return;
    loading_ = false;
    if (error.has_value() || !result.has_value())
    {
        keepFocusAfterCommand_ = false;
        refreshBugReportsAfterCommand_ = false;
        refreshAreaAfterCommand_ = false;
        reportIdToRestore_.reset();
        SetStatus(lila::shared::text::FromUtf8(
            error ? error->UserMessage() : "Réponse administrateur absente."), true);
        FocusCurrentMenu();
        return;
    }
    if (refreshAreaAfterCommand_)
    {
        refreshAreaAfterCommand_ = false;
        RestoreAreaFromItem();
        SetStatus(wxString(L"Modification enregistrée. Actualisation de la liste…"));
        const auto& area = domain::GetAdminAreas()[selectedSection_];
        if (area.id == "reports")
        {
            RefreshBugReports(false, false);
            return;
        }
        if (const auto* refresh = domain::FindAdminCommand(area.automaticCommandId))
        {
            ExecuteCommand(
                *refresh,
                nlohmann::json::parse(refresh->payloadTemplate),
                false);
            return;
        }
    }
    if (refreshBugReportsAfterCommand_ &&
        (command.id == "bugs.update" || command.id == "bugs.delete"))
    {
        refreshBugReportsAfterCommand_ = false;
        SetStatus(command.id == "bugs.delete"
            ? wxString(L"Rapport supprimé. Actualisation de la liste…")
            : wxString(L"Rapport modifié. Actualisation de la liste…"));
        RefreshBugReports(false, false);
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
    ShowResult(command, *result);
    if (announceLifecycle)
        SetStatus(wxString(L"Opération terminée : ") + wxString(command.label));
    if (keepFocusAfterCommand_)
    {
        keepFocusAfterCommand_ = false;
        FocusCurrentMenu();
    }
    else FocusResult();
}

}
