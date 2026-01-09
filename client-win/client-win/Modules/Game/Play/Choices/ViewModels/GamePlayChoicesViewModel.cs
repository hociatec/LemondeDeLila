using System;
using System.Collections.ObjectModel;
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
    private string? _selectedChoice;
    private string _choicesLabel = string.Empty;

    public GamePlayChoicesViewModel(GamePlayActionDispatcher actions)
    {
        _actions = actions ?? throw new ArgumentNullException(nameof(actions));
        _list = new GamePlayChoicesListController(
            PendingChoices,
            getSelected: () => SelectedChoice,
            setSelected: v => SelectedChoice = v);
        _sync = new GamePlayChoicesStateSynchronizer(_localChoices, _list);
        _submit = new GamePlayChoicesSubmission(
            tryBuildPendingAction: (session, choice) =>
            {
                return _actions.TryBuildPendingChoiceAction(session, choice, out var action) ? action : null;
            },
            hasServerPendingChoices: session => (session.LastState?.Pending?.Choices?.Count ?? 0) > 0,
            tryGetLocalAction: choice => _localChoices.TryGetAction(choice, out var action) ? action : null);
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
        return await _submit.SubmitAsync(
                session,
                SelectedChoice,
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
}
