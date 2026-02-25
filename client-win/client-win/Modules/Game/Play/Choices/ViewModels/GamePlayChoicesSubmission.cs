using System;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Session.Services;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayChoicesSubmission
{
    private readonly Func<GameSession, string, int, GameClientAction?> _tryBuildPendingAction;
    private readonly Func<GameSession, bool> _hasServerPendingChoices;
    private readonly Func<string, GameClientAction?> _tryGetLocalAction;
    private readonly Func<GameClientAction, string?, Task<bool>>? _confirmBeforeSendAsync;
    private int _submitInProgress;

    internal GamePlayChoicesSubmission(
        Func<GameSession, string, int, GameClientAction?> tryBuildPendingAction,
        Func<GameSession, bool> hasServerPendingChoices,
        Func<string, GameClientAction?> tryGetLocalAction,
        Func<GameClientAction, string?, Task<bool>>? confirmBeforeSendAsync = null)
    {
        _tryBuildPendingAction = tryBuildPendingAction ?? throw new ArgumentNullException(nameof(tryBuildPendingAction));
        _hasServerPendingChoices = hasServerPendingChoices ?? throw new ArgumentNullException(nameof(hasServerPendingChoices));
        _tryGetLocalAction = tryGetLocalAction ?? throw new ArgumentNullException(nameof(tryGetLocalAction));
        _confirmBeforeSendAsync = confirmBeforeSendAsync;
    }

    internal async Task<bool> SubmitAsync(
        GameSession session,
        string? selectedChoice,
        int selectedChoiceIndex,
        Action<string> emitError,
        Action<bool> clearLocalChoices,
        CancellationToken cancellationToken = default)
    {
        if (session == null) return false;

        if (Interlocked.Exchange(ref _submitInProgress, 1) == 1)
        {
            return false;
        }

        try
        {
            if (string.IsNullOrWhiteSpace(selectedChoice))
            {
                return false;
            }

            var choice = selectedChoice.Trim();
            GameClientAction? action = null;
            var clearOnlyWhenNoServerPending = false;

            // 1) Choix "pending" fournis par le serveur (quiz, exchange, ask_card, ...)
            if (_hasServerPendingChoices(session))
            {
                action = _tryBuildPendingAction(session, choice, selectedChoiceIndex);
                if (action == null)
                {
                    return false;
                }

                clearOnlyWhenNoServerPending = true;
            }
            else
            {
                // 2) Choix locaux (sélecteurs) construits à partir des informations serveur (ex: discard_card, ask_card).
                action = _tryGetLocalAction(choice);
                if (action == null)
                {
                    return false;
                }
            }

            if (_confirmBeforeSendAsync != null)
            {
                var confirmed = await _confirmBeforeSendAsync(action, choice).ConfigureAwait(false);
                if (!confirmed)
                {
                    return false;
                }
            }

            await session.SendActionsAsync(new[] { action }, cancellationToken).ConfigureAwait(false);
            clearLocalChoices(clearOnlyWhenNoServerPending);
            return true;
        }
        catch (Exception ex)
        {
            emitError(ex.Message);
            return false;
        }
        finally
        {
            Interlocked.Exchange(ref _submitInProgress, 0);
        }
    }
}
