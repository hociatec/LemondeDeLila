using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateStartupPrompt
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    public static async Task<bool> CheckAndPromptAsync(
        ClientConfiguration config,
        IDialogService dialogs,
        CancellationToken cancellationToken = default)
    {
        if (!await Gate.WaitAsync(0, cancellationToken).ConfigureAwait(true))
        {
            return true;
        }

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

                var confirm = await dialogs.Confirm(
                        "Mise à jour requise",
                        msg + "\n\nInstaller maintenant ?",
                        okText: "Mettre à jour",
                        cancelText: "Quitter")
                    .ConfigureAwait(true);

                if (confirm != true)
                {
                    Environment.Exit(0);
                    return false;
                }

                await ClientUpdateInstaller
                    .InstallLatestAsync(dialogs, info.Url, reason: "startup-required", cancellationToken)
                    .ConfigureAwait(true);
                Environment.Exit(0);
                return false;
            }

            if (info.UpdateAvailable == true)
            {
                // Update disponible: politique actuelle = forcer la mise à jour dès l'ouverture.
                var msg = "Une mise à jour du client est disponible.";
                if (!string.IsNullOrWhiteSpace(info.LatestVersion))
                {
                    msg += $"\nDernière version : {info.LatestVersion.Trim()}";
                }
                if (!string.IsNullOrWhiteSpace(info.Message))
                {
                    msg += $"\n\n{info.Message.Trim()}";
                }

                var confirm = await dialogs.Confirm(
                        "Mise à jour",
                        msg + "\n\nInstaller maintenant ?",
                        okText: "Mettre à jour",
                        cancelText: "Quitter")
                    .ConfigureAwait(true);

                if (confirm != true)
                {
                    // Politique: on force la mise à jour dès l'ouverture (évite les états "semi à jour").
                    Environment.Exit(0);
                    return false;
                }

                await ClientUpdateInstaller
                    .InstallLatestAsync(dialogs, info.Url, reason: "startup-available", cancellationToken)
                    .ConfigureAwait(true);
                Environment.Exit(0);
                return false;
            }

            return true;
        }
        catch
        {
            return true;
        }
        finally
        {
            Gate.Release();
        }
    }
}
