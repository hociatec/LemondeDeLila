using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateStartupPrompt
{
    public static async Task<bool> CheckAndPromptAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var info = await ClientUpdateApi.GetAsync(config, cancellationToken).ConfigureAwait(true);
            if (info == null)
            {
                return true;
            }

            if (info.UpdateRequired == true)
            {
                var msg = "Une mise à jour du client est requise pour continuer.";
                if (!string.IsNullOrWhiteSpace(info.MinRequiredVersion))
                {
                    msg += $"\n\nVersion minimale requise : {info.MinRequiredVersion.Trim()}";
                }
                if (!string.IsNullOrWhiteSpace(info.LatestVersion))
                {
                    msg += $"\nDernière version : {info.LatestVersion.Trim()}";
                }
                if (!string.IsNullOrWhiteSpace(info.Message))
                {
                    msg += $"\n\n{info.Message.Trim()}";
                }

                await ClientUpdateCoordinator.EnforceAsync(
                        dialogs,
                        title: "Mise à jour requise",
                        message: msg + "\n\nLancement de la mise à jour…",
                        clickOnceUrl: info.Url,
                        reason: "startup-required",
                        deDupKey: $"startup-required:{info.MinRequiredVersion}:{info.LatestVersion}",
                        cancellationToken: cancellationToken)
                    .ConfigureAwait(true);
                return false;
            }

            // Politique: toute mise à jour détectée est appliquée automatiquement.
            if (info.UpdateAvailable == true)
            {
                var msg = "Une mise à jour du client est disponible et va être installée automatiquement.";
                if (!string.IsNullOrWhiteSpace(info.LatestVersion))
                {
                    msg += $"\n\nDernière version : {info.LatestVersion.Trim()}";
                }
                if (!string.IsNullOrWhiteSpace(info.Message))
                {
                    msg += $"\n\n{info.Message.Trim()}";
                }

                await ClientUpdateCoordinator.EnforceAsync(
                        dialogs,
                        title: "Mise à jour",
                        message: msg + "\n\nLancement de la mise à jour…",
                        clickOnceUrl: info.Url,
                        reason: "startup-available",
                        deDupKey: $"startup-available:{info.LatestVersion}",
                        cancellationToken: cancellationToken)
                    .ConfigureAwait(true);
                return false;
            }

            return true;
        }
        catch
        {
            return true;
        }
    }
}
