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

                _ = await ClientUpdateCoordinator.PromptAsync(
                        dialogs,
                        title: "Mise à jour requise",
                        message: msg + "\n\nMettre à jour maintenant ?",
                        clickOnceUrl: info.Url,
                        reason: "startup-required",
                        deDupKey: $"startup-required:{info.MinRequiredVersion}:{info.LatestVersion}",
                        cancellationToken: cancellationToken)
                    .ConfigureAwait(true);
                return true;
            }

            if (info.UpdateAvailable == true)
            {
                // Update disponible: OK = continuer, Mettre à jour = lancer ClickOnce.
                var msg = "Une mise à jour du client est disponible.";
                if (!string.IsNullOrWhiteSpace(info.LatestVersion))
                {
                    msg += $"\nDernière version : {info.LatestVersion.Trim()}";
                }
                if (!string.IsNullOrWhiteSpace(info.Message))
                {
                    msg += $"\n\n{info.Message.Trim()}";
                }

                _ = await ClientUpdateCoordinator.PromptAsync(
                        dialogs,
                        title: "Mise à jour disponible",
                        message: msg + "\n\nMettre à jour maintenant ?",
                        clickOnceUrl: info.Url,
                        reason: "startup-available",
                        deDupKey: $"startup-available:{info.LatestVersion}",
                        cancellationToken: cancellationToken)
                    .ConfigureAwait(true);
                return true;
            }

            return true;
        }
        catch
        {
            return true;
        }
    }
}
