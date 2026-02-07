using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminBugReportDto[] _loadedBugReports = Array.Empty<AdminBugReportDto>();
    private AdminBugReportDto? _selectedBugReport;
    private AdminBugReportCommentDto[] _loadedBugReportComments = Array.Empty<AdminBugReportCommentDto>();
    private AdminBugReportStatus? _bugReportsListStatus;
    private readonly System.Collections.Generic.Dictionary<string, int> _bugReportCommentsCountById =
        new(StringComparer.OrdinalIgnoreCase);

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

        PreferDetailsFocus = false;
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
            var nextReports = (res.Items ?? new()).ToArray();

            // Notification (son) : si des commentaires ont été ajoutés depuis le dernier refresh.
            var shouldNotify = _bugReportCommentsCountById.Count > 0;
            var hasIncrease = false;
            foreach (var r in nextReports)
            {
                if (r == null || string.IsNullOrWhiteSpace(r.Id)) continue;
                var previous = _bugReportCommentsCountById.TryGetValue(r.Id, out var prev) ? prev : 0;
                var current = r.CommentsCount;
                if (current > previous)
                {
                    hasIncrease = true;
                }
                _bugReportCommentsCountById[r.Id] = current;
            }

            _loadedBugReports = nextReports;
            if (shouldNotify && hasIncrease)
            {
                _sounds.Play(client_win.Modules.Audio.Models.SoundId.BugReportCommentReceived);
            }
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
        PreferDetailsFocus = false;
        _page = AdminPage.BugReports;
        Title = "Rapports de bug";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();

        Items.Add(new AdminMenuItem("Nouveau rapport", tag: "bugReports.create"));

        if (_loadedBugReports.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun rapport."));
        }
        else
        {
            Items.Add(new AdminMenuItem($"En attente ({_loadedBugReports.Count(r => r.Status == AdminBugReportStatus.Pending)})", tag: "bugReports.list.pending"));
            Items.Add(new AdminMenuItem($"En cours ({_loadedBugReports.Count(r => r.Status == AdminBugReportStatus.InProgress)})", tag: "bugReports.list.in_progress"));
            Items.Add(new AdminMenuItem($"\u00C0 tester ({_loadedBugReports.Count(r => r.Status == AdminBugReportStatus.ToTest)})", tag: "bugReports.list.to_test"));
            Items.Add(new AdminMenuItem($"Termin\u00E9 ({_loadedBugReports.Count(r => r.Status == AdminBugReportStatus.Done)})", tag: "bugReports.list.done"));
            Items.Add(new AdminMenuItem($"Refus\u00E9 ({_loadedBugReports.Count(r => r.Status == AdminBugReportStatus.Refused)})", tag: "bugReports.list.refused"));
        }

        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : sélectionner. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildBugReportsStatusReports(AdminBugReportStatus status)
    {
        PreferDetailsFocus = false;
        _page = AdminPage.BugReportsStatusReports;
        _bugReportsListStatus = status;

        var title = status switch
        {
            AdminBugReportStatus.InProgress => "En cours",
            AdminBugReportStatus.ToTest => "\u00C0 tester",
            AdminBugReportStatus.Done => "Termin\u00E9",
            AdminBugReportStatus.Refused => "Refus\u00E9",
            _ => "En attente"
        };

        Title = $"Rapports - {title}";
        Details = string.Empty;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();

        var reports = _loadedBugReports.Where(r => r.Status == status).ToArray();
        if (reports.Length == 0)
        {
            Items.Add(new AdminMenuItem("Aucun rapport."));
        }
        else
        {
            foreach (var r in reports)
            {
                var subject = string.IsNullOrWhiteSpace(r.Subject) ? "(sans sujet)" : r.Subject.Trim();
                var comments = r.CommentsCount > 0 ? $" (commentaires +{r.CommentsCount})" : string.Empty;
                Items.Add(new AdminMenuItem(subject + comments, tag: r));
            }
        }

        SelectedItem = Items.FirstOrDefault();
        Status = "Entr\u00E9e : ouvrir. \u00C9chap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildBugReportCreate()
    {
        PreferDetailsFocus = false;
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
        PrimaryInputAcceptsReturn = false;
        SecondaryInputAcceptsReturn = true;
        IsTextInputVisible = true;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Status = "Saisissez puis Ctrl+Entrée pour envoyer. Échap : retour.";
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
        PreferDetailsFocus = false;
        _page = AdminPage.BugReportDetails;
        _selectedBugReport = report;

        Title = "Rapport de bug";
        var statusLine = report.Status switch
        {
            AdminBugReportStatus.InProgress => "Statut: En cours\n",
            AdminBugReportStatus.Done => "Statut: Terminé\n",
            AdminBugReportStatus.ToTest => "Statut: \u00C0 tester\n",
            AdminBugReportStatus.Refused => "Statut: Refus\u00E9\n",
            _ => string.Empty
        };
        var normalizedReportContent = NormalizeReportText(report.Content);
        var details =
            statusLine +
            $"Par: {report.CreatedByUsername} (id {report.CreatedByUserId})\n" +
            $"Créé: {report.CreatedAt}\n" +
            $"Maj: {report.UpdatedAt}\n" +
            $"Sujet: {report.Subject}\n\n" +
            normalizedReportContent;
        SetDetailsWithSegments(details, BuildDetailSegments(details));

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Consulter", tag: "bugReports.consult"));
        Items.Add(new AdminMenuItem("Ajouter un commentaire", tag: "bugReports.comments.add"));
        Items.Add(new AdminMenuItem("Modifier", tag: "bugReports.edit"));
        Items.Add(new AdminMenuItem("Supprimer", tag: "bugReports.delete"));
        if (report.Status != AdminBugReportStatus.Pending)
        {
            Items.Add(new AdminMenuItem("Passer en: En attente", tag: "bugReports.status.pending"));
        }
        if (report.Status != AdminBugReportStatus.InProgress)
        {
            Items.Add(new AdminMenuItem("Passer en: En cours", tag: "bugReports.status.in_progress"));
        }
        if (report.Status != AdminBugReportStatus.ToTest)
        {
            Items.Add(new AdminMenuItem("Passer en: \u00C0 tester", tag: "bugReports.status.to_test"));
        }
        if (report.Status != AdminBugReportStatus.Done)
        {
            Items.Add(new AdminMenuItem("Passer en: Terminé", tag: "bugReports.status.done"));
        }
        if (report.Status != AdminBugReportStatus.Refused)
        {
            Items.Add(new AdminMenuItem("Passer en: Refus\u00E9", tag: "bugReports.status.refused"));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : action. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task LoadBugReportConsultAsync(AdminBugReportDto report)
    {
        if (IsBusy)
        {
            return;
        }

        PreferDetailsFocus = true;
        _page = AdminPage.BugReportConsult;
        _selectedBugReport = report;
        Title = "Rapport - Consultation";
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
            var res = await _admin.ListBugReportCommentsAsync(report.Id).ConfigureAwait(true);
            _loadedBugReportComments = (res.Items ?? new()).ToArray();
            BuildBugReportConsult(report);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Rapport", ex.Message).ConfigureAwait(true);
            BuildBugReportDetails(report);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildBugReportConsult(AdminBugReportDto report)
    {
        PreferDetailsFocus = true;
        _page = AdminPage.BugReportConsult;
        _selectedBugReport = report;

        Title = "Rapport - Consultation";
        var statusLine = report.Status switch
        {
            AdminBugReportStatus.InProgress => "Statut: En cours\n",
            AdminBugReportStatus.Done => "Statut: Terminé\n",
            AdminBugReportStatus.ToTest => "Statut: \u00C0 tester\n",
            AdminBugReportStatus.Refused => "Statut: Refus\u00E9\n",
            _ => string.Empty
        };

        var header =
            statusLine +
            $"Par: {report.CreatedByUsername} (id {report.CreatedByUserId})\n" +
            $"Créé: {report.CreatedAt}\n" +
            $"Maj: {report.UpdatedAt}\n" +
            $"Sujet: {report.Subject}\n\n" +
            NormalizeReportText(report.Content);

        var commentsBlock = _loadedBugReportComments.Length == 0
            ? "Aucun commentaire."
            : string.Join(
                "\n\n---\n\n",
                _loadedBugReportComments.Select(c =>
                {
                    var normalized = NormalizeReportText(c.Content);
                    return
                        $"[{c.CreatedAt}] {c.CreatedByUsername} (id {c.CreatedByUserId})\n{normalized}"
                            .TrimEnd();
                }));

        var details = header + "\n\n====================\nCommentaires\n\n" + commentsBlock;
        details = NormalizeDetailsForScreenReader(details);
        SetDetailsWithSegments(details, null);

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        SelectedItem = null;
        Status = "\u00C9chap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task LoadBugReportCommentsAsync(AdminBugReportDto report)
    {
        if (IsBusy)
        {
            return;
        }

        PreferDetailsFocus = false;
        _page = AdminPage.BugReportComments;
        _selectedBugReport = report;
        Title = "Rapport - Commentaires";
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
            var res = await _admin.ListBugReportCommentsAsync(report.Id).ConfigureAwait(true);
            _loadedBugReportComments = (res.Items ?? new()).ToArray();
            BuildBugReportComments(report);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Commentaires", ex.Message).ConfigureAwait(true);
            BuildBugReportDetails(report);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildBugReportComments(AdminBugReportDto report)
    {
        PreferDetailsFocus = false;
        _page = AdminPage.BugReportComments;
        _selectedBugReport = report;

        Title = "Rapport - Commentaires";
        var subject = string.IsNullOrWhiteSpace(report.Subject) ? "(sans sujet)" : report.Subject.Trim();

        if (_loadedBugReportComments.Length == 0)
        {
            var details = $"Sujet: {subject}\n\nAucun commentaire.";
            SetDetailsWithSegments(details, BuildDetailSegments(details));
        }
        else
        {
            var lines = _loadedBugReportComments
                .Select(c =>
                {
                    var normalized = NormalizeReportText(c.Content);
                    return
                        $"[{c.CreatedAt}] {c.CreatedByUsername} (id {c.CreatedByUserId})\n{normalized}"
                            .TrimEnd();
                })
                .ToArray();
            var details = $"Sujet: {subject}\n\n" + string.Join("\n\n---\n\n", lines);
            SetDetailsWithSegments(details, BuildDetailSegments(details));
        }

        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Ajouter un commentaire", tag: "bugReports.comments.add"));
        Items.Add(new AdminMenuItem("Rafraîchir", tag: "bugReports.comments.refresh"));
        if (report.Status != AdminBugReportStatus.Refused)
        {
            Items.Add(new AdminMenuItem("Passer en: Refus\u00E9", tag: "bugReports.status.refused"));
        }
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : action. Échap : retour.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private void BuildBugReportCommentCreate(AdminBugReportDto report)
    {
        PreferDetailsFocus = false;
        _page = AdminPage.BugReportCommentCreate;
        _selectedBugReport = report;

        Title = "Rapport - Nouveau commentaire";
        Details = "Saisissez le commentaire, puis Valider.";
        Items.Clear();
        Items.Add(new AdminMenuItem("Valider / Envoyer", tag: "bugReports.comments.submit"));
        SelectedItem = Items.FirstOrDefault();

        TextInputLabel = string.Empty;
        TextInput = string.Empty;
        SecondaryInputLabel = "Commentaire";
        SecondaryInput = string.Empty;
        SecondaryInputAcceptsReturn = true;
        IsTextInputVisible = false;
        IsSecondaryInputVisible = true;
        IsAdditionalPermissionsVisible = false;
        Status = "Entrée : envoyer. Échap : annuler.";
        UpdateFilterVisibility();
        RestoreFocusIfAny();
    }

    private async Task SubmitBugReportCommentAsync()
    {
        var report = _selectedBugReport;
        if (report == null)
        {
            return;
        }

        var content = (SecondaryInput ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(content))
        {
            await _dialogs.ShowError("Commentaire", "Commentaire requis.").ConfigureAwait(true);
            return;
        }

        try
        {
            IsBusy = true;
            await _admin.AddBugReportCommentAsync(report.Id, content).ConfigureAwait(true);
            try
            {
                // Recharger le rapport pour récupérer `commentsCount` (affiché dans les listes).
                var refreshed = await _admin.GetBugReportAsync(report.Id).ConfigureAwait(true);
                UpsertLoadedBugReport(refreshed);
                _bugReportCommentsCountById[refreshed.Id] = refreshed.CommentsCount;
                _selectedBugReport = refreshed;
                report = refreshed;
            }
            catch
            {
                // best-effort
            }
            await _dialogs.ShowInfo("Commentaire", "Commentaire ajouté.").ConfigureAwait(true);
            await LoadBugReportConsultAsync(report).ConfigureAwait(true);
        }
        catch (Exception ex)
        {
            await _dialogs.ShowError("Commentaire", ex.Message).ConfigureAwait(true);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void BuildBugReportEdit(AdminBugReportDto report)
    {
        PreferDetailsFocus = false;
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
        PrimaryInputAcceptsReturn = false;
        SecondaryInputAcceptsReturn = true;
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

    private static string NormalizeReportText(string? rawText)
    {
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return string.Empty;
        }

        var normalized = rawText
            .Replace("\r\n", "\n")
            .Replace("\r", "\n");

        normalized = Regex.Replace(normalized, "\n{3,}", "\n\n");
        return normalized.TrimEnd('\n');
    }

    private static IReadOnlyList<string> BuildDetailSegments(string details)
    {
        if (string.IsNullOrWhiteSpace(details))
        {
            return Array.Empty<string>();
        }

        var parts = details
            .Split(new[] { "\n\n" }, StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Trim())
            .Where(part => !string.IsNullOrEmpty(part))
            .ToArray();

        return parts.Length > 0 ? parts : Array.Empty<string>();
    }

    private static string NormalizeDetailsForScreenReader(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        var normalized = text.Replace("\r\n", "\n")
            .Replace("\r", "\n");

        // Preserve empty lines so screen readers announce them (avoid repeating the next line).
        var lines = normalized.Split('\n');
        for (var i = 0; i < lines.Length; i++)
        {
            if (lines[i].Length == 0)
            {
                lines[i] = " ";
            }
        }

        return string.Join(Environment.NewLine, lines);
    }
}
