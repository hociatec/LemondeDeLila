using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Updates;

/// <summary>
/// Orchestrateur unique des dialogues de mise à jour + déclenchement ClickOnce.
/// Objectif: éviter la duplication de logique et les comportements "parfois ça marche / parfois non".
/// </summary>
public static class ClientUpdateCoordinator
{
    private static readonly SemaphoreSlim Gate = new(1, 1);
    private static string? _lastKey;
    private static DateTime _lastShownAtUtc = DateTime.MinValue;
    private static readonly TimeSpan Cooldown = TimeSpan.FromSeconds(5);

    public static event Action<ClientUpdateFlowState>? FlowChanged;

    public static async Task EnforceAsync(
        IDialogService dialogs,
        string title,
        string message,
        string? clickOnceUrl,
        string reason,
        bool required,
        string? deDupKey = null,
        CancellationToken cancellationToken = default)
    {
        if (dialogs == null) throw new ArgumentNullException(nameof(dialogs));

        var key = (deDupKey ?? string.Empty).Trim();
        if (key.Length > 0 &&
            string.Equals(_lastKey, key, StringComparison.Ordinal) &&
            DateTime.UtcNow - _lastShownAtUtc < Cooldown)
        {
            return;
        }

        if (!await Gate.WaitAsync(0, cancellationToken).ConfigureAwait(true))
        {
            return;
        }

        try
        {
            _lastKey = key.Length > 0 ? key : null;
            _lastShownAtUtc = DateTime.UtcNow;

            FlowChanged?.Invoke(new ClientUpdateFlowState(ClientUpdateFlowKind.Enforcing, required, title, message, reason));

            var result = await ClientUpdateInstaller
                .InstallLatestAsync(dialogs, clickOnceUrl, reason, cancellationToken)
                .ConfigureAwait(true);

            if (!result.Started && required)
            {
                foreach (var delay in new[] { 1200, 2500 })
                {
                    await Task.Delay(delay, cancellationToken).ConfigureAwait(true);
                    result = await ClientUpdateInstaller
                        .InstallLatestAsync(dialogs, clickOnceUrl, reason, cancellationToken)
                        .ConfigureAwait(true);
                    if (result.Started)
                    {
                        break;
                    }
                }
            }
            var started = result.Started;

            FlowChanged?.Invoke(new ClientUpdateFlowState(
                started ? ClientUpdateFlowKind.InstallStarted : ClientUpdateFlowKind.InstallFailed,
                required,
                title,
                started
                    ? "Mise à jour lancée. Le client peut continuer, mais un redémarrage sera nécessaire pour appliquer la mise à jour."
                    : (string.IsNullOrWhiteSpace(result.ErrorMessage) ? "Impossible de lancer la mise à jour." : result.ErrorMessage!),
                reason));

            if (!started)
            {
                return;
            }

            // Pas de choix utilisateur: on applique la mise à jour automatiquement.
            // - UpdatedInPlace => la MAJ est déjà téléchargée/appliquée, on peut relancer immédiatement.
            // - InstallerLaunched => un launcher attend la fermeture du process pour lancer ClickOnce.
            if (result.Outcome == ClientUpdateInstaller.ClientUpdateInstallOutcome.UpdatedInPlace)
            {
                _ = UpdateRestartHelper.RestartCurrentProcess(reason: "update-inplace");
            }
            else
            {
                // Laisse le launcher dfshim démarrer ClickOnce après exit.
                Environment.Exit(0);
            }
        }
        finally
        {
            Gate.Release();
        }
    }

}
