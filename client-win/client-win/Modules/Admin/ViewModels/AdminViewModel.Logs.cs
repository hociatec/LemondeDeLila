using System;
using System.Linq;
using System.Threading.Tasks;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private void ShowLogs()
    {
        _page = AdminPage.Logs;
        Title = "Logs serveurs";
        Details = "Télécharger les logs les plus récents.";
        IsTextInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        IsSecondaryInputVisible = false;
        Items.Clear();
        Items.Add(new AdminMenuItem("Télécharger les logs", tag: "logs.download"));
        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : télécharger. Échap : retour.";
        UpdateFilterVisibility();
    }

    private async Task DownloadLogsAsync()
    {
        if (IsBusy)
        {
            return;
        }
        IsBusy = true;
        try
        {
            var linesCount = Math.Max(1, LogLines);
            var filter = string.IsNullOrWhiteSpace(LogFilter) ? null : LogFilter.Trim();

            var payload = await _admin.DownloadLogsAsync(linesCount, filter).ConfigureAwait(true);
            var preview = payload.Lines.Count > 0
                ? string.Join(Environment.NewLine, payload.Lines)
                : "(aucune ligne retournée)";

            var header = $"Fichier : {payload.File} ({payload.Total} lignes, affichage {payload.Lines.Count})";
            await _dialogs.ShowInfo("Logs", $"{header}{Environment.NewLine}{Environment.NewLine}{preview}")
                .ConfigureAwait(true);
            Status = $"Logs {payload.File} chargés ({payload.Lines.Count}/{payload.Total})";
        }
        finally
        {
            IsBusy = false;
        }
    }
}
