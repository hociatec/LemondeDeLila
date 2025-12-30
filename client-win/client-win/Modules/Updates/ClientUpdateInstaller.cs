using System;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

public static class ClientUpdateInstaller
{
    public static async Task<bool> InstallLatestAsync(
        IDialogService dialogs,
        string? updatesBaseUrl,
        string reason,
        CancellationToken cancellationToken = default)
    {
        _ = updatesBaseUrl; // Le déploiement ClickOnce connaît déjà sa source : on n'ouvre jamais de navigateur.

        // Objectif: ne jamais ouvrir une page web. On force la mise à jour via ClickOnce (si installé en ClickOnce).
        var clickOnce = TryGetApplicationDeploymentType();
        if (clickOnce == null)
        {
            await dialogs
                .ShowError(
                    "Mise à jour",
                    "Cette installation ne supporte pas la mise à jour automatique (ClickOnce).\n\n" +
                    "Réinstalle le client via l'installateur ClickOnce, puis les mises à jour seront automatiques.")
                .ConfigureAwait(true);
            return false;
        }

        if (!TryGetStaticBool(clickOnce, "IsNetworkDeployed", out var isNetworkDeployed) || !isNetworkDeployed)
        {
            await dialogs
                .ShowError(
                    "Mise à jour",
                    "Cette installation ne supporte pas la mise à jour automatique (ClickOnce).\n\n" +
                    "Réinstalle le client via l'installateur ClickOnce, puis les mises à jour seront automatiques.")
                .ConfigureAwait(true);
            return false;
        }

        try
        {
            var deployment = clickOnce.GetProperty("CurrentDeployment", BindingFlags.Public | BindingFlags.Static)?.GetValue(null);
            if (deployment == null)
            {
                throw new InvalidOperationException("ClickOnce indisponible (CurrentDeployment null).");
            }

            // Si aucune MAJ n'est détectée alors que le serveur la demande,
            // on préfère échouer explicitement plutôt que d'ouvrir un navigateur.
            var info = deployment.GetType().GetMethod("CheckForUpdate", BindingFlags.Public | BindingFlags.Instance)?.Invoke(deployment, null);
            if (info == null)
            {
                throw new InvalidOperationException("ClickOnce: CheckForUpdate() a renvoyé null.");
            }

            var updateAvailable = info.GetType().GetProperty("UpdateAvailable", BindingFlags.Public | BindingFlags.Instance)?.GetValue(info) as bool?;
            if (updateAvailable != true)
            {
                await dialogs
                    .ShowError(
                        "Mise à jour",
                        "Aucune mise à jour n'est disponible pour l'instant.\n\n" +
                        "Si le serveur exige une version plus récente, la publication ClickOnce n'est probablement pas à jour.")
                    .ConfigureAwait(true);
                return false;
            }

            await dialogs
                .ShowInfo(
                    "Mise à jour",
                    "Mise à jour en cours…\n\nLe client va redémarrer automatiquement.")
                .ConfigureAwait(true);

            deployment.GetType().GetMethod("Update", BindingFlags.Public | BindingFlags.Instance)?.Invoke(deployment, null);

            // Après Update(), le nouveau binaire est en place: on redémarre immédiatement.
            UpdateRestartHelper.RestartCurrentProcess($"clickonce-update:{reason}");
            return true;
        }
        catch (Exception ex)
        {
            await dialogs
                .ShowError(
                    "Mise à jour",
                    $"La mise à jour a échoué.\n\n{ex.GetType().Name}: {ex.Message}")
                .ConfigureAwait(true);
            return false;
        }
    }

    private static Type? TryGetApplicationDeploymentType()
    {
        // IMPORTANT: on passe par reflection pour éviter une référence compile-time à System.Deployment
        // (non disponible sur Linux, alors que le client tourne sur Windows).
        try
        {
            return Type.GetType("System.Deployment.Application.ApplicationDeployment, System.Deployment", throwOnError: false);
        }
        catch
        {
            return null;
        }
    }

    private static bool TryGetStaticBool(Type type, string propertyName, out bool value)
    {
        value = false;
        try
        {
            var prop = type.GetProperty(propertyName, BindingFlags.Public | BindingFlags.Static);
            if (prop == null || prop.PropertyType != typeof(bool))
            {
                return false;
            }
            value = (bool)(prop.GetValue(null) ?? false);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
