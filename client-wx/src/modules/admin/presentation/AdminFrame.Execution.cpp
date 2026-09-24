#include "modules/admin/presentation/AdminFrame.h"

#include <utility>
#include <memory>
#include <nlohmann/json.hpp>
#include <wx/msgdlg.h>
#include <wx/textctrl.h>
#include <wx/textdlg.h>
#include <wx/weakref.h>
#include "modules/admin/application/AdminService.h"
#include "modules/audio/application/IAudioService.h"
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
        RefreshBugReports(false);
        return;
    }
    if (LoadBotTimingSettingsBeforeEditing(command)) return;
    nlohmann::json payload;
    try
    {
        payload = nlohmann::json::parse(command.payloadTemplate);
        if (command.id == "bots.settings.update" && botTimingPayload_.is_object())
            for (const auto& item : botTimingPayload_.items())
                payload[item.key()] = item.value();
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
    if (command.id.starts_with("sounds.") && ContextCommandMutates(command))
        soundIdToRestore_ = payload.value("soundId", std::string{});
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
    if (command.id == "bugs.list" && !loadingReportCountsOnly_)
        bugReportListPayload_ = payload;
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

}
