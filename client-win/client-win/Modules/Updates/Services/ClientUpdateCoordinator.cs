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

            // Enforced update: user must acknowledge (no "Ignorer").
            // This blocks the UI until OK, then we start the installer.
            try
            {
                await dialogs.ShowInfo(
                        string.IsNullOrWhiteSpace(title) ? "Mise à jour" : title,
                        (message ?? string.Empty).Trim())
                    .ConfigureAwait(true);
            }
            catch
            {
                // ignore dialog failures; still enforce update attempt
            }

            var started = await ClientUpdateInstaller
                .InstallLatestAsync(dialogs, clickOnceUrl, reason, cancellationToken)
                .ConfigureAwait(true);

            FlowChanged?.Invoke(new ClientUpdateFlowState(
                started ? ClientUpdateFlowKind.InstallStarted : ClientUpdateFlowKind.InstallFailed,
                required,
                title,
                started
                    ? "Mise à jour lancée. Le client peut continuer, mais un redémarrage sera nécessaire pour appliquer la mise à jour."
                    : "Impossible de lancer la mise à jour.",
                reason));

            // On ne ferme plus brutalement le client: la MAJ peut se faire en arrière-plan, et l'utilisateur pourra redémarrer quand il le souhaite.
        }
        finally
        {
            Gate.Release();
        }
    }

    public static async Task<bool> PromptAsync(
        IDialogService dialogs,
        string title,
        string message,
        string? clickOnceUrl,
        string reason,
        string? deDupKey = null,
        CancellationToken cancellationToken = default)
    {
        if (dialogs == null) throw new ArgumentNullException(nameof(dialogs));

        var key = (deDupKey ?? string.Empty).Trim();
        if (key.Length > 0 &&
            string.Equals(_lastKey, key, StringComparison.Ordinal) &&
            DateTime.UtcNow - _lastShownAtUtc < Cooldown)
        {
            return false;
        }

        if (!await Gate.WaitAsync(0, cancellationToken).ConfigureAwait(true))
        {
            return false;
        }

        try
        {
            _lastKey = key.Length > 0 ? key : null;
            _lastShownAtUtc = DateTime.UtcNow;

            var wantUpdate = await dialogs.Confirm(
                    string.IsNullOrWhiteSpace(title) ? "Mise à jour" : title,
                    (message ?? string.Empty).Trim(),
                    okText: "Mettre à jour",
                    cancelText: "OK")
                .ConfigureAwait(true) == true;

            if (!wantUpdate)
            {
                return false;
            }

            var started = await ClientUpdateInstaller
                .InstallLatestAsync(dialogs, clickOnceUrl, reason, cancellationToken)
                .ConfigureAwait(true);

            if (started)
            {
                // ClickOnce termine l'installation au redémarrage.
                Environment.Exit(0);
            }

            return started;
        }
        finally
        {
            Gate.Release();
        }
    }
}
