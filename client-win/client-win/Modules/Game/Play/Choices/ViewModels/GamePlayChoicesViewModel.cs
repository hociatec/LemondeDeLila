using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core;
using client_win.Modules.Game.Play.Actions.Services;
using client_win.Modules.Game.Play.Choices.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;

namespace client_win.Modules.Game.Play.Choices.ViewModels;

internal sealed class GamePlayChoicesViewModel : ObservableObject
{
    private readonly GamePlayActionDispatcher _actions;
    private readonly GamePlayLocalChoices _localChoices = new();
    private readonly GamePlayChoicesListController _list;
    private readonly GamePlayChoicesStateSynchronizer _sync;
    private readonly GamePlayChoicesSubmission _submit;
    private int _selectedChoiceIndex = -1;
    private string _choicesLabel = string.Empty;

    public GamePlayChoicesViewModel(
        GamePlayActionDispatcher actions,
        Func<GameClientAction, string?, Task<bool>>? confirmBeforeSendAsync = null)
    {
        _actions = actions ?? throw new ArgumentNullException(nameof(actions));
        _list = new GamePlayChoicesListController(
            PendingChoices,
            getSelectedIndex: () => SelectedChoiceIndex,
            setSelectedIndex: v => SelectedChoiceIndex = v);
        _sync = new GamePlayChoicesStateSynchronizer(_localChoices, _list);
        _submit = new GamePlayChoicesSubmission(
            tryBuildPendingAction: (session, choice, index) =>
            {
                return _actions.TryBuildPendingChoiceAction(session, choice, index, out var action) ? action : null;
            },
            hasServerPendingChoices: session => (session.LastState?.Pending?.Choices?.Count ?? 0) > 0,
            tryGetLocalAction: choice => _localChoices.TryGetAction(choice, out var action) ? action : null,
            confirmBeforeSendAsync: confirmBeforeSendAsync);
    }

    public ObservableCollection<string> PendingChoices { get; } = new();

    public string ChoicesLabel
    {
        get => _choicesLabel;
        private set => SetProperty(ref _choicesLabel, value);
    }

    public int SelectedChoiceIndex
    {
        get => _selectedChoiceIndex;
        set => SetProperty(ref _selectedChoiceIndex, value);
    }

    public async Task<bool> SubmitSelectedChoiceAsync(
        GameSession session,
        Action<string> emitError,
        CancellationToken cancellationToken = default)
    {
        if (session == null) return false;
        var idx = SelectedChoiceIndex;
        var choice = idx >= 0 && idx < PendingChoices.Count ? PendingChoices[idx] : null;
        return await _submit.SubmitAsync(
                session,
                choice,
                idx,
                emitError,
                clearLocalChoices: onlyWhenNoServerPending => ClearLocalChoices(onlyWhenNoServerPending, session),
                cancellationToken)
            .ConfigureAwait(false);
    }

    public void UpdateFromState(GameStateDto state, int? viewerPlayerId, Func<GameStateDto, bool> canStartAskCardSelection)
    {
        _sync.UpdateFromState(state, viewerPlayerId, canStartAskCardSelection, setLabel: s => ChoicesLabel = s);
    }

    public bool TryStartDiscardSelection(GameStateDto state, Action<string> announce)
    {
        return _sync.TryStartDiscardSelection(state, announce, setLabel: s => ChoicesLabel = s);
    }

    public bool TryStartAskSelection(GameStateDto state, Action<string> announce)
    {
        return _sync.TryStartAskSelection(state, announce, setLabel: s => ChoicesLabel = s);
    }

    public bool TryStartPlayCardSelection(
        GameStateDto state,
        string cardId,
        string? cardLabel,
        Action<string> announce)
    {
        if (state == null || string.IsNullOrWhiteSpace(cardId))
        {
            return false;
        }

        var actions = state.Actions ?? new List<GameAvailableActionDto>();
        if (actions.Count == 0)
        {
            return false;
        }

        var candidates = actions
            .Where(a => string.Equals(a.Type, "play_card", StringComparison.OrdinalIgnoreCase))
            .Where(a => TryExtractCardId(a.Payload, out var payloadCardId) &&
                        string.Equals(payloadCardId, cardId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (candidates.Count <= 1)
        {
            return false;
        }

        var namesById = new Dictionary<int, string>();
        foreach (var player in state.Players ?? new List<GamePlayerDto>())
        {
            if (player == null) continue;
            var name = (player.Username ?? string.Empty).Trim();
            if (name.Length == 0)
            {
                name = $"Joueur {player.Id}";
            }
            namesById[player.Id] = name;
        }

        var choices = new Dictionary<string, GameClientAction>(StringComparer.Ordinal);
        foreach (var action in candidates)
        {
            var label = "Jouer";
            if (TryExtractTargetPlayerId(action.Payload, out var targetId))
            {
                var name = namesById.TryGetValue(targetId, out var targetName)
                    ? targetName
                    : $"Joueur {targetId}";
                label = $"Sur {name}";
            }

            var key = ChoiceLabelUniquifier.MakeUniqueChoiceLabel(choices, label);
            choices[key] = new GameClientAction(action.Type, action.Payload);
        }

        if (choices.Count == 0)
        {
            return false;
        }

        _localChoices.Set("play_card", choices);
        _list.Apply(choices.Keys.ToList());

        var labelText = string.IsNullOrWhiteSpace(cardLabel)
            ? "Choisissez une cible dans la liste, puis Entrée."
            : $"Choisissez une cible pour {cardLabel}, puis Entrée.";
        ChoicesLabel = labelText;
        announce(labelText);
        return true;
    }

    public bool HasDiscardChoices(GameStateDto? state) => GamePlayChoiceBuilder.HasDiscardChoices(state);

    public void ClearLocalChoices(bool onlyWhenNoServerPending, GameSession session)
    {
        if (session == null) return;
        _localChoices.Clear();
        ChoicesLabel = string.Empty;

        if (onlyWhenNoServerPending)
        {
            var pending = session.LastState?.Pending?.Choices;
            if (pending != null && pending.Count > 0)
            {
                return;
            }
        }
        _list.Clear();
    }

    private static bool TryExtractCardId(JsonElement payload, out string cardId)
    {
        cardId = string.Empty;
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!payload.TryGetProperty("cardId", out var candidate) ||
            candidate.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        var value = candidate.GetString();
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        cardId = value.Trim();
        return true;
    }

    private static bool TryExtractTargetPlayerId(JsonElement payload, out int targetPlayerId)
    {
        targetPlayerId = 0;
        if (payload.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        if (!payload.TryGetProperty("targetPlayerId", out var candidate))
        {
            return false;
        }

        if (candidate.ValueKind == JsonValueKind.Number && candidate.TryGetInt32(out var asInt))
        {
            targetPlayerId = asInt;
            return true;
        }

        if (candidate.ValueKind == JsonValueKind.String && int.TryParse(candidate.GetString(), out var parsed))
        {
            targetPlayerId = parsed;
            return true;
        }

        return false;
    }
}
