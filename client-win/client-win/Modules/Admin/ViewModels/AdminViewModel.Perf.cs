using System;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using client_win.Modules.Admin.Dtos;

namespace client_win.Modules.Admin.ViewModels;

public sealed partial class AdminViewModel
{
    private AdminPerfSnapshotDto? _lastPerf;

    private async Task LoadPerfAsync()
    {
        if (IsBusy) return;
        _page = AdminPage.Perf;
        Title = "Diagnostics (latence)";
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
            _lastPerf = await _admin.GetPerfSnapshotAsync(windowSeconds: 300).ConfigureAwait(true);
            _dispatcher.Invoke(ShowPerf);
        }
        finally
        {
            IsBusy = false;
        }
    }

    private void ShowPerf()
    {
        _page = AdminPage.Perf;
        Title = "Diagnostics (latence)";
        IsTextInputVisible = false;
        IsSecondaryInputVisible = false;
        IsAdditionalPermissionsVisible = false;
        Items.Clear();

        Items.Add(new AdminMenuItem("Rafraîchir", tag: "perf.refresh"));

        var snap = _lastPerf;
        if (snap == null)
        {
            Items.Add(new AdminMenuItem("Aucune donnée."));
            SelectedItem = Items.FirstOrDefault();
            Status = "Entrée : rafraîchir. Échap : retour.";
            return;
        }

        Details = $"Fenêtre: {snap.WindowSeconds}s. Généré: {snap.GeneratedAt}.";

        foreach (var e in (snap.Events ?? new()).OrderByDescending(x => x.P95Ms))
        {
            var c2s = e.ClientToServerCount > 0 && e.ClientToServerP95Ms.HasValue
                ? $" c2s p95={Fmt(e.ClientToServerP95Ms.Value)}ms"
                : string.Empty;
            var label = $"{e.Event} — n={e.Count} avg={Fmt(e.AvgMs)}ms p95={Fmt(e.P95Ms)}ms max={Fmt(e.MaxMs)}ms{c2s}";
            Items.Add(new AdminMenuItem(label));
        }

        if (Items.Count == 1)
        {
            Items.Add(new AdminMenuItem("Aucun événement récent."));
        }

        SelectedItem = Items.FirstOrDefault();
        Status = "Entrée : rafraîchir. Échap : retour.";
        UpdateFilterVisibility();
    }

    private static string Fmt(double value) =>
        value.ToString("0", CultureInfo.InvariantCulture);
}
