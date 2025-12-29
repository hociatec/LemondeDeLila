using System;
using System.Deployment.Application;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Updates;

public sealed class ClickOnceUpdateService : IUpdateService
{
    private readonly ILogger<ClickOnceUpdateService> _logger;
    private bool _checkedOnce;
    private UpdateCheckResult? _lastCheck;

    public ClickOnceUpdateService(ILogger<ClickOnceUpdateService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public bool IsSupported => ApplicationDeployment.IsNetworkDeployed;

    public string CurrentVersion
    {
        get
        {
            if (ApplicationDeployment.IsNetworkDeployed)
            {
                return ApplicationDeployment.CurrentDeployment.CurrentVersion.ToString();
            }

            var version = Assembly.GetEntryAssembly()?.GetName().Version?.ToString();
            return string.IsNullOrWhiteSpace(version) ? "inconnue" : version;
        }
    }

    public async Task<UpdateCheckResult> CheckAsync(CancellationToken cancellationToken)
    {
        if (!ApplicationDeployment.IsNetworkDeployed)
        {
            _lastCheck = new UpdateCheckResult(
                IsUpdateAvailable: false,
                AvailableVersion: null,
                StatusMessage: "Mises à jour indisponibles (application non installée via ClickOnce).");
            _checkedOnce = true;
            return _lastCheck;
        }

        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            var info = await Task.Run(() =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                return ApplicationDeployment.CurrentDeployment.CheckForDetailedUpdate();
            }, cancellationToken).ConfigureAwait(true);

            if (!info.UpdateAvailable)
            {
                _lastCheck = new UpdateCheckResult(
                    IsUpdateAvailable: false,
                    AvailableVersion: null,
                    StatusMessage: "Aucune mise à jour disponible.");
                _checkedOnce = true;
                return _lastCheck;
            }

            var version = info.AvailableVersion?.ToString();
            var sizePart = info.UpdateSizeBytes > 0
                ? $" (~{FormatBytes(info.UpdateSizeBytes)})"
                : string.Empty;

            _lastCheck = new UpdateCheckResult(
                IsUpdateAvailable: true,
                AvailableVersion: version,
                StatusMessage: $"Nouvelle version {version} disponible{sizePart}.");
            _checkedOnce = true;
            return _lastCheck;
        }
        catch (InvalidDeploymentException ex)
        {
            _logger.LogWarning(ex, "ClickOnce: déploiement invalide.");
            _lastCheck = new UpdateCheckResult(false, null, "Impossible de vérifier les mises à jour (déploiement invalide).");
            _checkedOnce = true;
            return _lastCheck;
        }
        catch (DeploymentDownloadException ex)
        {
            _logger.LogWarning(ex, "ClickOnce: téléchargement impossible.");
            _lastCheck = new UpdateCheckResult(false, null, "Impossible de contacter le serveur de mises à jour.");
            _checkedOnce = true;
            return _lastCheck;
        }
    }

    public async Task<UpdateInstallResult> InstallAsync(CancellationToken cancellationToken)
    {
        if (!ApplicationDeployment.IsNetworkDeployed)
        {
            return new UpdateInstallResult(
                Installed: false,
                RestartRequired: false,
                StatusMessage: "Installation impossible (application non installée via ClickOnce).");
        }

        if (!_checkedOnce)
        {
            _lastCheck = await CheckAsync(cancellationToken).ConfigureAwait(true);
        }

        if (_lastCheck is { IsUpdateAvailable: false })
        {
            return new UpdateInstallResult(
                Installed: false,
                RestartRequired: false,
                StatusMessage: "Aucune mise à jour disponible.");
        }

        try
        {
            cancellationToken.ThrowIfCancellationRequested();

            await Task.Run(() =>
            {
                cancellationToken.ThrowIfCancellationRequested();
                ApplicationDeployment.CurrentDeployment.Update();
            }, cancellationToken).ConfigureAwait(true);

            return new UpdateInstallResult(
                Installed: true,
                RestartRequired: true,
                StatusMessage: "Mise à jour installée. Redémarrage requis.");
        }
        catch (DeploymentDownloadException ex)
        {
            _logger.LogWarning(ex, "ClickOnce: échec téléchargement mise à jour.");
            return new UpdateInstallResult(
                Installed: false,
                RestartRequired: false,
                StatusMessage: "Échec du téléchargement de la mise à jour.");
        }
        catch (InvalidDeploymentException ex)
        {
            _logger.LogWarning(ex, "ClickOnce: mise à jour invalide.");
            return new UpdateInstallResult(
                Installed: false,
                RestartRequired: false,
                StatusMessage: "Mise à jour invalide (déploiement).");
        }
    }

    private static string FormatBytes(long bytes)
    {
        string[] units = { "o", "Ko", "Mo", "Go" };
        double size = bytes;
        var unitIndex = 0;
        while (size >= 1024 && unitIndex < units.Length - 1)
        {
            size /= 1024;
            unitIndex++;
        }
        return unitIndex == 0 ? $"{bytes} {units[0]}" : $"{size:0.#} {units[unitIndex]}";
    }
}
