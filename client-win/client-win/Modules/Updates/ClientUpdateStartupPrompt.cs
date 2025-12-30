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

            // On ne spam pas si le serveur ne sait pas comparer.
            if (info.UpdateAvailable != true && info.UpdateRequired != true)
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

            // Update disponible (non bloquant): on repropose à chaque lancement tant que ce n'est pas à jour.
            {
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
                        cancelText: "Plus tard")
                    .ConfigureAwait(true);

                if (confirm == true)
                {
                    await ClientUpdateInstaller
                        .InstallLatestAsync(dialogs, info.Url, reason: "startup-available", cancellationToken)
                        .ConfigureAwait(true);
                    Environment.Exit(0);
                    return false;
                }
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

