using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateInstaller
{
    private const string DefaultBaseUrl = "https://api.lilas.hociatec.fr/updates/client-win/";

    public static async Task<bool> InstallLatestAsync(
        IDialogService dialogs,
        string? updatesBaseUrl,
        string reason,
        CancellationToken cancellationToken = default)
    {
        // 1) Si on est en ClickOnce: on télécharge/applique la MAJ, puis restart.
        if (UpdateEnvironment.IsLikelyClickOnceInstall() && !UpdateEnvironment.IsRunningUnderDotnetHost())
        {
            var result = await ClickOnceUpdater.CheckAndUpdateAsync().ConfigureAwait(true);
            if (result.Updated)
            {
                // L'installation est appliquée, on redémarre sur la nouvelle version.
                UpdateRestartHelper.RestartCurrentProcess($"clickonce-update:{reason}");
                return true;
            }

            if (!string.IsNullOrWhiteSpace(result.Error))
            {
                await dialogs.ShowError(
                        "Mise à jour",
                        "Impossible d'appliquer la mise à jour automatiquement.\n\n" +
                        result.Error)
                    .ConfigureAwait(true);
            }
        }

        // 2) Fallback sans rediriger vers un site:
        // On tente de lancer directement le fichier .application (ClickOnce) depuis l'URL publique.
        var baseUrl = NormalizeBaseUrl(updatesBaseUrl);
        var applicationUrl = await TryResolveApplicationUrlAsync(baseUrl, cancellationToken).ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(applicationUrl))
        {
            try
            {
                Process.Start(new ProcessStartInfo(applicationUrl) { UseShellExecute = true });
                return true;
            }
            catch (Exception ex)
            {
                await dialogs.ShowError(
                        "Mise à jour",
                        $"Impossible de lancer l'installateur ClickOnce.\n\n{ex.GetType().Name}: {ex.Message}")
                    .ConfigureAwait(true);
                return false;
            }
        }

        // 3) Dernier recours: ouvrir la page (browser). (Best-effort.)
        try
        {
            Process.Start(new ProcessStartInfo(baseUrl) { UseShellExecute = true });
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string NormalizeBaseUrl(string? url)
    {
        var candidate = string.IsNullOrWhiteSpace(url) ? DefaultBaseUrl : url.Trim();
        if (!candidate.EndsWith("/", StringComparison.Ordinal))
        {
            candidate += "/";
        }
        return candidate;
    }

    private static async Task<string?> TryResolveApplicationUrlAsync(string baseUrl, CancellationToken cancellationToken)
    {
        // Cas direct
        if (baseUrl.EndsWith(".application", StringComparison.OrdinalIgnoreCase))
        {
            return baseUrl;
        }

        // 1) Index HTML (généré côté serveur) -> lien .application
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(6) };
            var html = await http.GetStringAsync(baseUrl, cancellationToken).ConfigureAwait(false);

            // href="LeMondeDeLila.application" (ou autre)
            var rx = new Regex("href\\s*=\\s*\"(?<href>[^\"]+\\.application)\"", RegexOptions.IgnoreCase);
            var m = rx.Match(html);
            if (m.Success)
            {
                var href = m.Groups["href"].Value;
                return new Uri(new Uri(baseUrl), href).ToString();
            }
        }
        catch
        {
            // ignore
        }

        // 2) Noms connus (stables côté serveur)
        foreach (var name in new[] { "LeMondeDeLila.application", "client-win.application" })
        {
            try
            {
                var url = new Uri(new Uri(baseUrl), name).ToString();
                using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
                using var res = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                    .ConfigureAwait(false);
                if (res.IsSuccessStatusCode)
                {
                    return url;
                }
            }
            catch
            {
                // ignore
            }
        }

        return null;
    }
}

