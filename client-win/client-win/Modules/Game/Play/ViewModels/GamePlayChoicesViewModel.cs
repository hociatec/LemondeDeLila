using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Game.Play.Dtos;
using client_win.Modules.Game.Play.Services;

namespace client_win.Modules.Game.Play.ViewModels;

internal sealed class GamePlayChoicesViewModel : ObservableObject
{
    private readonly GamePlayActionDispatcher _actions;
    private int _choiceSubmitInProgress;
    private string? _selectedChoice;

    private readonly Dictionary<string, GameClientAction> _localChoiceActions = new(StringComparer.Ordinal);
    private string _localChoiceMode = string.Empty;
    private string _choicesLabel = string.Empty;

    public GamePlayChoicesViewModel(GamePlayActionDispatcher actions)
    {
        _actions = actions ?? throw new ArgumentNullException(nameof(actions));
    }

    public ObservableCollection<string> PendingChoices { get; } = new();

    public string ChoicesLabel
    {
        get => _choicesLabel;
        private set => SetProperty(ref _choicesLabel, value);
    }

    public string? SelectedChoice
    {
        get => _selectedChoice;
        set => SetProperty(ref _selectedChoice, value);
    }

    public async Task<bool> SubmitSelectedChoiceAsync(
        GameSession session,
        Action<string> emitError,
        CancellationToken cancellationToken = default)
    {
        if (session == null) return false;

        if (Interlocked.Exchange(ref _choiceSubmitInProgress, 1) == 1)
        {
            return false;
        }

        try
        {
            var choice = SelectedChoice;
            if (string.IsNullOrWhiteSpace(choice))
            {
                return false;
            }

            var state = session.LastState;

            // 1) Choix "pending" fournis par le serveur (quiz, exchange, ask_card, ...)
            if (state?.Pending?.Choices != null && state.Pending.Choices.Count > 0)
            {
                if (!_actions.TryBuildPendingChoiceAction(session, choice, out var action) || action == null)
                {
                    return false;
                }

                await session.SendActionsAsync(new[] { action }, cancellationToken).ConfigureAwait(false);
                ClearLocalChoices(onlyWhenNoServerPending: true, session);
                return true;
            }

            // 2) Choix locaux (sélecteurs) construits à partir des informations serveur (ex: discard_card, ask_card).
            var trimmedChoice = choice.Trim();
            if (_localChoiceActions.TryGetValue(trimmedChoice, out var localAction))
            {
                await session.SendActionsAsync(new[] { localAction }, cancellationToken).ConfigureAwait(false);
                ClearLocalChoices(onlyWhenNoServerPending: false, session);
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            emitError(ex.Message);
            return false;
        }
        finally
        {
            Interlocked.Exchange(ref _choiceSubmitInProgress, 0);
        }
    }

    public void UpdateFromState(GameStateDto state, Func<GameStateDto, bool> canStartAskCardSelection)
    {
        if (state == null) return;

        var serverChoices = ExtractServerPendingChoices(state);
        var hasServerPendingChoices = serverChoices.Count > 0;

        if (hasServerPendingChoices)
        {
            _localChoiceActions.Clear();
            _localChoiceMode = string.Empty;

            ChoicesLabel = BuildServerChoicesLabel(state.Pending);
            ApplyChoices(serverChoices);
            return;
        }

        if (string.Equals(_localChoiceMode, "ask", StringComparison.OrdinalIgnoreCase) &&
            _localChoiceActions.Count > 0 &&
            canStartAskCardSelection(state))
        {
            return;
        }

        if (GamePlayChoiceBuilder.ShouldAutoOfferDiscardSelection(state, drawAvailable: HasAction(state, "draw")) &&
            GamePlayChoiceBuilder.TryBuildDiscardChoices(state, out var discardChoices))
        {
            ApplyLocalChoices("discard_auto", discardChoices);
            return;
        }

        _localChoiceActions.Clear();
        _localChoiceMode = string.Empty;
        ChoicesLabel = string.Empty;
        if (PendingChoices.Count > 0)
        {
            PendingChoices.Clear();
            SelectedChoice = null;
        }
    }

    public bool TryStartDiscardSelection(GameStateDto state, Action<string> announce)
    {
        if (state == null) return false;
        if (!GamePlayChoiceBuilder.TryBuildDiscardChoices(state, out var choices))
        {
            return false;
        }

        ApplyLocalChoices("discard", choices);
        ChoicesLabel = "Choisissez une carte à défausser dans la liste, puis Entrée.";
        announce(ChoicesLabel);
        return true;
    }

    public bool TryStartAskSelection(GameStateDto state, Action<string> announce)
    {
        if (state == null) return false;
        if (!GamePlayChoiceBuilder.TryBuildAskCardChoices(state, out var choices))
        {
            return false;
        }

        ApplyLocalChoices("ask", choices);
        ChoicesLabel = "Choisissez une demande dans la liste, puis Entrée.";
        announce(ChoicesLabel);
        return true;
    }

    public bool HasDiscardChoices(GameStateDto? state) => GamePlayChoiceBuilder.HasDiscardChoices(state);

    public void ClearLocalChoices(bool onlyWhenNoServerPending, GameSession session)
    {
        if (session == null) return;
        _localChoiceActions.Clear();
        _localChoiceMode = string.Empty;
        ChoicesLabel = string.Empty;

        if (onlyWhenNoServerPending)
        {
            var pending = session.LastState?.Pending?.Choices;
            if (pending != null && pending.Count > 0)
            {
                return;
            }
        }

        PendingChoices.Clear();
        SelectedChoice = null;
    }

    private static string BuildServerChoicesLabel(GamePendingDto? pending)
    {
        if (pending == null)
        {
            return string.Empty;
        }

        if (!string.IsNullOrWhiteSpace(pending.Label))
        {
            return pending.Label.Trim();
        }

        if (!string.IsNullOrWhiteSpace(pending.Question))
        {
            return pending.Question.Trim();
        }

        var type = (pending.Type ?? string.Empty).Trim();
        return string.IsNullOrWhiteSpace(type) ? string.Empty : $"En attente: {type}";
    }

    private static List<string> ExtractServerPendingChoices(GameStateDto state)
    {
        var raw = state.Pending?.Choices;
        if (raw == null || raw.Count == 0)
        {
            return new List<string>();
        }

        return raw
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .ToList();
    }

    private void ApplyChoices(IReadOnlyList<string> choices)
    {
        if (AreSameChoices(PendingChoices, choices))
        {
            if (PendingChoices.Count > 0 && string.IsNullOrWhiteSpace(SelectedChoice))
            {
                SelectedChoice = PendingChoices[0];
            }
            return;
        }

        PendingChoices.Clear();
        foreach (var choice in choices)
        {
            PendingChoices.Add(choice);
        }
        SelectedChoice = PendingChoices.Count > 0 ? PendingChoices[0] : null;
    }

    private void ApplyLocalChoices(string mode, Dictionary<string, GameClientAction> choices)
    {
        _localChoiceMode = mode;
        _localChoiceActions.Clear();
        foreach (var kv in choices)
        {
            _localChoiceActions[kv.Key] = kv.Value;
        }

        ApplyChoices(choices.Keys.ToList());
    }

    private static bool AreSameChoices(ObservableCollection<string> existing, IReadOnlyList<string> next)
    {
        if (existing.Count != next.Count)
        {
            return false;
        }

        for (var i = 0; i < existing.Count; i++)
        {
            if (!string.Equals(existing[i], next[i], StringComparison.Ordinal))
            {
                return false;
            }
        }

        return true;
    }

    private static bool HasAction(GameStateDto state, string actionType)
    {
        if (string.IsNullOrWhiteSpace(actionType))
        {
            return false;
        }

        var actions = state.Actions;
        if (actions == null || actions.Count == 0)
        {
            return false;
        }

        return actions.Any(a => string.Equals(a.Type, actionType, StringComparison.OrdinalIgnoreCase));
    }
}
