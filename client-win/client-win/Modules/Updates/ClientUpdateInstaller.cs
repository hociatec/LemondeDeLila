using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Net.Http;
using System.Text;
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
        _ = reason;

        // 1) Si l'app est déjà une installation ClickOnce, tenter une mise à jour silencieuse "in-place".
        // Objectif: éviter toute UI ClickOnce ("Voulez-vous mettre à jour maintenant ?") et les cas où dfshim
        // ouvre une fenêtre système.
        if (TryUpdateCurrentDeploymentSilently())
        {
            return true;
        }

        // Objectif: mise à jour uniforme et robuste:
        // - ne jamais ouvrir une page web
        // - lancer ClickOnce via dfshim (même si Windows aurait ouvert un navigateur)
        // - en cas d'installation ClickOnce existante, utiliser UpdateLocation quand possible (répare aussi les fichiers manquants)
        string? applicationUrl = null;
        string? lastTriedBaseUrl = null;

        foreach (var raw in new[]
                 {
                     // Priorité: l'UpdateLocation ClickOnce de l'installation courante (le plus fiable).
                     TryGetCurrentDeploymentUpdateLocation(),
                     // Ensuite: l'URL fournie par le serveur (peut être absente ou non-ClickOnce).
                     updatesBaseUrl,
                     // Enfin: fallback stable.
                     DefaultBaseUrl
                 })
        {
            var baseUrl = NormalizeBaseUrl(raw);
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                continue;
            }

            if (string.Equals(baseUrl, lastTriedBaseUrl, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }
            lastTriedBaseUrl = baseUrl;

            applicationUrl = await TryResolveApplicationUrlAsync(baseUrl, cancellationToken).ConfigureAwait(true);
            if (!string.IsNullOrWhiteSpace(applicationUrl))
            {
                break;
            }
        }

        if (string.IsNullOrWhiteSpace(applicationUrl))
        {
            await dialogs
                .ShowError(
                    "Mise à jour",
                    "Impossible de trouver l'installateur ClickOnce (.application) sur le serveur.\n\n" +
                    "Le serveur n'est peut-être pas correctement publié.")
                .ConfigureAwait(true);
            return false;
        }

        try
        {
            var validationError = await TryValidateClickOnceServerAsync(applicationUrl, cancellationToken).ConfigureAwait(true);
            if (!string.IsNullOrWhiteSpace(validationError))
            {
                await dialogs.ShowError("Mise à jour", validationError).ConfigureAwait(true);
                return false;
            }

            // Prefer dfshim to force ClickOnce handler (évite les cas où Windows ouvre le navigateur / télécharge au lieu d'installer).
            if (TryLaunchClickOnce(applicationUrl))
            {
                return true;
            }

            // IMPORTANT: pas de fallback navigateur — on veut un comportement uniforme.
            await dialogs.ShowError(
                    "Mise à jour",
                    "Impossible de lancer ClickOnce automatiquement sur ce poste.\n\n" +
                    "Cause probable : composant ClickOnce manquant/corrompu, ou association .application absente.\n\n" +
                    "Action: réinstalle le client via l'installateur ClickOnce, puis relance.")
                .ConfigureAwait(true);
            return false;
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

    private static async Task<string?> TryValidateClickOnceServerAsync(
        string applicationUrl,
        CancellationToken cancellationToken)
    {
        // But: éviter le message ClickOnce générique "fichiers manquants" en détectant
        // l'incohérence côté serveur avant de lancer dfshim.
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(8) };

            string appXml;
            try
            {
                appXml = await http.GetStringAsync(applicationUrl, cancellationToken).ConfigureAwait(false);
            }
            catch (HttpRequestException)
            {
                // Publication ClickOnce peut faire un swap: petit retry pour éviter un faux 404 transitoire.
                await Task.Delay(600, cancellationToken).ConfigureAwait(false);
                appXml = await http.GetStringAsync(applicationUrl, cancellationToken).ConfigureAwait(false);
            }
            appXml = appXml.Replace("\uFEFF", string.Empty, StringComparison.Ordinal);

            var dep = Regex.Match(
                appXml,
                "dependentAssembly[^>]*codebase\\s*=\\s*\"(?<codebase>[^\"]+)\"",
                RegexOptions.IgnoreCase);
            var depCodebase = dep.Success ? dep.Groups["codebase"].Value : null;
            if (string.IsNullOrWhiteSpace(depCodebase))
            {
                return
                    "Mise à jour ClickOnce impossible.\n\n" +
                    "Le manifeste ClickOnce (.application) est invalide (dépendance manquante).\n\n" +
                    $"URL: {applicationUrl}";
            }

            // Le manifest met souvent des backslashes Windows: normaliser vers "/" pour l'URL.
            depCodebase = depCodebase.Replace('\\', '/');
            var manifestUrl = new Uri(new Uri(applicationUrl), depCodebase).ToString();

            var manifestXml = await http.GetStringAsync(manifestUrl, cancellationToken).ConfigureAwait(false);
            manifestXml = manifestXml.Replace("\uFEFF", string.Empty, StringComparison.Ordinal);

            // On vérifie qu'une partie des fichiers référencés est disponible.
            // Si ClickOnce voit des 404 ici, il affiche "Des fichiers manquent".
            var baseDir = manifestUrl.Substring(0, manifestUrl.LastIndexOf('/') + 1);

            var fileMatches = Regex.Matches(manifestXml, "file[^>]*name\\s*=\\s*\"(?<name>[^\"]+)\"", RegexOptions.IgnoreCase);
            var missing = new System.Collections.Generic.List<string>();

            foreach (Match m in fileMatches)
            {
                var name = (m.Groups["name"].Value ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(name)) continue;
                name = name.Replace('\\', '/');

                var url = new Uri(new Uri(baseDir), name).ToString();
                try
                {
                    using var res = await http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellationToken).ConfigureAwait(false);
                    if (!res.IsSuccessStatusCode)
                    {
                        missing.Add(name);
                        if (missing.Count >= 12) break;
                    }
                }
                catch
                {
                    missing.Add(name);
                    if (missing.Count >= 12) break;
                }
            }

            if (missing.Count > 0)
            {
                var lines = string.Join("\n", missing.ConvertAll(x => $"- {x}"));
                return
                    "Mise à jour ClickOnce impossible.\n\n" +
                    "Le serveur est publié mais incomplet : ClickOnce ne trouve pas certains fichiers.\n\n" +
                    "Action: relance la publication ClickOnce (GitHub Actions) ou republie côté serveur.\n\n" +
                    $"Fichiers manquants (extrait):\n{lines}";
            }

            return null;
        }
        catch (Exception ex)
        {
            // Ne bloque pas la mise à jour si la validation échoue (réseau instable),
            // mais on préfère un message clair si l'accès aux manifests est impossible.
            return
                "Mise à jour ClickOnce impossible.\n\n" +
                "Impossible de valider les fichiers de mise à jour sur le serveur.\n\n" +
                $"Détail: {ex.GetType().Name}: {ex.Message}\n" +
                $"URL: {applicationUrl}";
        }
    }

    private static bool TryLaunchClickOnce(string applicationUrl)
    {
        try
        {
            // https://learn.microsoft.com/en-us/visualstudio/deployment/clickonce-security-and-deployment
            // rundll32 dfshim.dll,ShOpenVerbApplication <url>
            // IMPORTANT: ClickOnce peut échouer si on lance l'installateur alors que l'app est encore en train de se fermer
            // (fichiers en cours d'utilisation). On lance donc un petit "launcher" PowerShell qui attend la fin du process,
            // puis lance dfshim. Ça évite le cas "Impossible de démarrer l'application" au premier essai.
            var pid = Environment.ProcessId;
            var launcherStarted = TryLaunchClickOnceAfterExit(pid, applicationUrl);
            if (launcherStarted)
            {
                return true;
            }

            var args = $"dfshim.dll,ShOpenVerbApplication \"{applicationUrl}\"";

            // Évite les cas où rundll32 n'est pas résolu dans le PATH (sinon on retombe sur un fallback navigateur).
            var rundll32 = Path.Combine(Environment.SystemDirectory ?? string.Empty, "rundll32.exe");
            if (string.IsNullOrWhiteSpace(Environment.SystemDirectory) || !File.Exists(rundll32))
            {
                rundll32 = "rundll32.exe";
            }

            var psi = new ProcessStartInfo
            {
                FileName = rundll32,
                Arguments = args,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            Process.Start(psi);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static bool TryLaunchClickOnceAfterExit(int pid, string applicationUrl)
    {
        try
        {
            if (pid <= 0 || string.IsNullOrWhiteSpace(applicationUrl))
            {
                return false;
            }

            var windowsDir = Environment.GetFolderPath(Environment.SpecialFolder.Windows) ?? string.Empty;
            var psPath = Path.Combine(windowsDir, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
            if (string.IsNullOrWhiteSpace(windowsDir) || !File.Exists(psPath))
            {
                return false;
            }

            var safeUrl = applicationUrl.Replace("\"", "\\\"");
            var scriptLines = new List<string>
            {
                "$ErrorActionPreference = 'SilentlyContinue'",
                $"$pid = {pid}",
                "try { (Get-Process -Id $pid -ErrorAction Stop).WaitForExit() } catch { }",
                "$rundll32 = Join-Path $env:SystemRoot 'System32\\rundll32.exe'",
                $"$args = 'dfshim.dll,ShOpenVerbApplication \"{safeUrl}\"'",
                "Start-Process -FilePath $rundll32 -ArgumentList $args -WindowStyle Hidden",
            };
            var script = string.Join(";", scriptLines);
            var encoded = Convert.ToBase64String(Encoding.Unicode.GetBytes(script));

            var psi = new ProcessStartInfo
            {
                FileName = psPath,
                Arguments = $"-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -EncodedCommand {encoded}",
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
            };
            Process.Start(psi);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string? TryGetCurrentDeploymentUpdateLocation()
    {
        // Utilise la location ClickOnce actuelle quand l'app est déjà installée en ClickOnce.
        // Réduit les cas "fichier manquant" en forçant une réparation via le manifest officiel.
        try
        {
            var deploymentType = Type.GetType(
                "System.Deployment.Application.ApplicationDeployment, System.Deployment",
                throwOnError: false);
            if (deploymentType == null) return null;

            var isNetworkDeployedProp = deploymentType.GetProperty(
                "IsNetworkDeployed",
                BindingFlags.Public | BindingFlags.Static);
            var isNetworkDeployed = isNetworkDeployedProp?.GetValue(null) as bool? ?? false;
            if (!isNetworkDeployed) return null;

            var currentDeploymentProp = deploymentType.GetProperty(
                "CurrentDeployment",
                BindingFlags.Public | BindingFlags.Static);
            var current = currentDeploymentProp?.GetValue(null);
            if (current == null) return null;

            var updateLocationProp = current.GetType().GetProperty(
                "UpdateLocation",
                BindingFlags.Public | BindingFlags.Instance);
            var updateLocation = updateLocationProp?.GetValue(current) as Uri;
            return updateLocation?.ToString();
        }
        catch
        {
            return null;
        }
    }

    private static string? NormalizeBaseUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var candidate = url.Trim();

        // Certains endpoints renvoient un lien de téléchargement (zip/exe). On les ignore ici:
        // l'updater doit impérativement partir d'un .application ou d'un dossier ClickOnce.
        if (candidate.EndsWith(".zip", StringComparison.OrdinalIgnoreCase) ||
            candidate.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (!candidate.EndsWith("/", StringComparison.Ordinal) &&
            !candidate.EndsWith(".application", StringComparison.OrdinalIgnoreCase))
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

    private static bool TryUpdateCurrentDeploymentSilently()
    {
        try
        {
            var deploymentType = Type.GetType(
                "System.Deployment.Application.ApplicationDeployment, System.Deployment",
                throwOnError: false);
            if (deploymentType == null) return false;

            var isNetworkDeployedProp = deploymentType.GetProperty(
                "IsNetworkDeployed",
                BindingFlags.Public | BindingFlags.Static);
            var isNetworkDeployed = isNetworkDeployedProp?.GetValue(null) as bool? ?? false;
            if (!isNetworkDeployed) return false;

            var currentDeploymentProp = deploymentType.GetProperty(
                "CurrentDeployment",
                BindingFlags.Public | BindingFlags.Static);
            var current = currentDeploymentProp?.GetValue(null);
            if (current == null) return false;

            // CheckForUpdate() -> bool (si dispo)
            try
            {
                var checkMethod = current.GetType().GetMethod(
                    "CheckForUpdate",
                    BindingFlags.Public | BindingFlags.Instance,
                    binder: null,
                    types: Type.EmptyTypes,
                    modifiers: null);
                if (checkMethod != null)
                {
                    var available = checkMethod.Invoke(current, null) as bool? ?? false;
                    if (!available)
                    {
                        return false;
                    }
                }
            }
            catch
            {
                // Si la vérification échoue, tenter Update() quand même (best-effort).
            }

            var updateMethod = current.GetType().GetMethod(
                "Update",
                BindingFlags.Public | BindingFlags.Instance,
                binder: null,
                types: Type.EmptyTypes,
                modifiers: null);
            if (updateMethod == null) return false;

            updateMethod.Invoke(current, null);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
