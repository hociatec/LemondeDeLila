using System;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminBugReportDto[] _loadedBugReports = Array.Empty<AdminBugReportDto>();
    private AdminBugReportDto? _selectedBugReport;

    private void UpsertLoadedBugReport(AdminBugReportDto report)
    {
        if (_loadedBugReports.Length == 0)
        {
            _loadedBugReports = new[] { report };
            return;
        }

        var idx = Array.FindIndex(_loadedBugReports, r => string.Equals(r.Id, report.Id, StringComparison.OrdinalIgnoreCase));
        if (idx < 0)
        {
            _loadedBugReports = _loadedBugReports.Concat(new[] { report }).ToArray();
            return;
        }

        _loadedBugReports[idx] = report;
    }

    private void RemoveLoadedBugReport(string id)
    {
        if (_loadedBugReports.Length == 0)
        {
            return;
        }

        _loadedBugReports = _loadedBugReports
            .Where(r => !string.Equals(r.Id, id, StringComparison.OrdinalIgnoreCase))
            .ToArray();
    }

    private async Task LoadBugReportsAsync()
    {
        if (IsBusy)
        {
            return;
        }

        _page = AdminPage.BugReports;
        Title = "Rapports de bug";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "Chargement...";

        IsBusy = true;
        try
        {
            var res = await _admin.ListBugReportsAsync().ConfigureAwait(true);
            _loadedBugReports = (res.Items ?? new()).ToArray();
            BuildBugReports();
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rapports", ex.Message).ConfigureAwait(true);
            BuildRoot();
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildBugReports()
    {
        _page = AdminPage.BugReports;
        Title = "Rapports de bug";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();

        Items.Add(new AdminMenuItem("Nouveau rapport", tag: "bugReports.create"));
        Items.Add(new AdminMenuItem("Rafraîchir", tag: "bugReports.refresh"));

        if (_loadedBugReports.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun rapport."));
        }
        else
        {
            foreach (var r in _loadedBugReports)
            {
                var status = r.Status switch
                {
                    AdminBugReportStatus.InProgress => "En cours",
                    AdminBugReportStatus.Done => "Terminé",
                    _ => "En attente"
                };
                var subject = string.IsNullOrWhiteSpace(r.Subject) ? "(sans sujet)" : r.Subject.Trim();
                Items.Add(new AdminMenuItem($"[{status}] {subject}", tag: r));
            }
        }

        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildBugReportCreate()
    {
        _page = AdminPage.BugReportCreate;
        Title = "Rapport de bug - Nouveau";
        Details = "Renseignez le sujet et le contenu, puis Valider.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider / Envoyer", tag: "bugReports.submit"));
        SelectedItem = Items.FirstOrDefault();

        TextInputLabel = "Sujet";
        TextInput = string.Empty;
        SecondaryInputLabel = "Contenu";
        SecondaryInput = string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Status = "Saisissez puis Entrée pour envoyer. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task SubmitBugReportAsync()
    {
        var subject = (TextInput ?? string.Empty).Trim();
        var content = (SecondaryInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(subject))
        {
            await _dialogs.ShowError("Rapport", "Sujet requis.").ConfigureAwait(true);
            return;
        }
        if (string.IsNullOrWhiteSpace(content))
        {
            await _dialogs.ShowError("Rapport", "Contenu requis.").ConfigureAwait(true);
            return;
        }

        try
        {
            IsBusy = true;
            var report = await _admin.CreateBugReportAsync(subject, content).ConfigureAwait(true);
            await _dialogs.ShowInfo("Rapport", "Rapport envoyé (en attente).").ConfigureAwait(true);
            _selectedBugReport = report;
            await LoadBugReportsAsync().ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rapport", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildBugReportDetails(AdminBugReportDto report)
    {
        _page = AdminPage.BugReportDetails;
        _selectedBugReport = report;

        Title = "Rapport de bug";
        var status = report.Status switch
        {
            AdminBugReportStatus.InProgress => "En cours",
            AdminBugReportStatus.Done => "Terminé",
            _ => "En attente"
        };
        Details =
            $"Statut: {status}\n" +
            $"Par: {report.CreatedByUsername} (id {report.CreatedByUserId})\n" +
            $"Créé: {report.CreatedAt}\n" +
            $"Maj: {report.UpdatedAt}\n" +
            $"Sujet: {report.Subject}\n\n" +
            $"{report.Content}";

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Modifier", tag: "bugReports.edit"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "bugReports.delete"));
        Items.Add(new AdminMenuItem("Passer en: En attente", tag: "bugReports.status.pending"));
        Items.Add(new AdminMenuItem("Passer en: En cours", tag: "bugReports.status.in_progress"));
        Items.Add(new AdminMenuItem("Passer en: Terminé", tag: "bugReports.status.done"));
        Items.Add(new AdminMenuItem("Rafraîchir", tag: "bugReports.details.refresh"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : action. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildBugReportEdit(AdminBugReportDto report)
    {
        _page = AdminPage.BugReportEdit;
        _selectedBugReport = report;

        Title = "Rapport de bug - Modifier";
        Details = "Modifiez le sujet et le contenu, puis Valider.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider / Enregistrer", tag: "bugReports.edit.submit"));
        SelectedItem = Items.FirstOrDefault();

        TextInputLabel = "Sujet";
        TextInput = report.Subject ?? string.Empty;
        SecondaryInputLabel = "Contenu";
        SecondaryInput = report.Content ?? string.Empty;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Status = "Entrée : enregistrer. Échap : annuler.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task SubmitBugReportEditAsync()
    {
        var report = _selectedBugReport;
        if (report == null)
        {
            return;
        }

        var subject = (TextInput ?? string.Empty).Trim();
        var content = (SecondaryInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(subject))
        {
            await _dialogs.ShowError("Rapport", "Sujet requis.").ConfigureAwait(true);
            return;
        }
        if (string.IsNullOrWhiteSpace(content))
        {
            await _dialogs.ShowError("Rapport", "Contenu requis.").ConfigureAwait(true);
            return;
        }

        try
        {
            IsBusy = true;
            var updated = await _admin.UpdateBugReportAsync(report.Id, subject, content).ConfigureAwait(true);
            UpsertLoadedBugReport(updated);
            _selectedBugReport = updated;
            await _dialogs.ShowInfo("Rapport", "Rapport modifié.").ConfigureAwait(true);
            BuildBugReportDetails(updated);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rapport", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task UpdateBugReportStatusAsync(string status)
    {
        var report = _selectedBugReport;
        if (report == null)
        {
            return;
        }

        try
        {
            IsBusy = true;
            var updated = await _admin.UpdateBugReportStatusAsync(report.Id, status).ConfigureAwait(true);
            UpsertLoadedBugReport(updated);
            _selectedBugReport = updated;
            BuildBugReportDetails(updated);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rapport", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private async Task DeleteBugReportAsync()
    {
        var report = _selectedBugReport;
        if (report == null)
        {
            return;
        }

        var subject = string.IsNullOrWhiteSpace(report.Subject) ? "(sans sujet)" : report.Subject.Trim();
        var confirm = await _dialogs.Confirm("Suppression", $"Supprimer le rapport: {subject} ?").ConfigureAwait(true);
        if (confirm != true)
        {
            return;
        }

        try
        {
            IsBusy = true;
            var ok = await _admin.DeleteBugReportAsync(report.Id).ConfigureAwait(true);
            if (!ok)
            {
                await _dialogs.ShowError("Suppression", "Suppression impossible.").ConfigureAwait(true);
                return;
            }

            RemoveLoadedBugReport(report.Id);
            _selectedBugReport = null;
            await _dialogs.ShowInfo("Suppression", "Rapport supprimé.").ConfigureAwait(true);
            BuildBugReports();
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Suppression", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }
}
