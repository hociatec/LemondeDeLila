using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using client_win.Modules.Audio.Services;
using System.Windows.Input;
using client_win.Core;
using client_win.Modules.Game.Play.Actions.Dtos;
using client_win.Modules.Game.Play.Grid.Services;
using client_win.Modules.Game.Play.Session.Services;
using client_win.Modules.Game.Play.State.Dtos;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Play.Grid.ViewModels;

public sealed partial class GridBoardViewModel : ObservableObject
{
    private readonly Dictionary<string, List<GridAction>> _gridActionsByCellKey = new(StringComparer.Ordinal);
    private readonly IDialogService _dialogs;
    private readonly ISoundService _sounds;
    private readonly Func<GameSession?> _getSession;
    private readonly Func<bool> _canInteract;
    private readonly Action<string> _announce;
    private readonly AsyncRelayCommand<GridCellViewModel> _cellCommand;

    private int? _viewerPlayerId;
    private bool _isVisible;
    private int _size = 9;
    private string _status = string.Empty;
    private bool _isEntityGrabbed;
    private bool _pawnPositionsPrimed;
    private readonly Dictionary<int, (int X, int Y)> _lastPawnPosByOwnerId = new();
    private bool _wallLayoutPrimed;
    private int _lastWallLayoutHash;
    private bool _pendingSelfWallSound;
    private int _lastSeenTurnIndex = -1;
    private int? _lastSeenCurrentPlayerId;
    private HashSet<string> _previousHorizontalWalls = new(StringComparer.OrdinalIgnoreCase);
    private HashSet<string> _previousVerticalWalls = new(StringComparer.OrdinalIgnoreCase);

    public GridBoardViewModel(
        IDialogService dialogs,
        ISoundService sounds,
        Func<GameSession?> getSession,
        Func<bool> canInteract,
        Action<string> announce)
    {
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _sounds = sounds ?? throw new ArgumentNullException(nameof(sounds));
        _getSession = getSession ?? throw new ArgumentNullException(nameof(getSession));
        _canInteract = canInteract ?? throw new ArgumentNullException(nameof(canInteract));
        _announce = announce ?? throw new ArgumentNullException(nameof(announce));

        _cellCommand = new AsyncRelayCommand<GridCellViewModel>(
            async cell =>
            {
                if (cell == null) return;
                await HandleGridCellActivatedAsync(cell).ConfigureAwait(true);
            },
            canExecute: cell => _canInteract() && IsVisible && cell != null);
    }

    public bool IsVisible
    {
        get => _isVisible;
        private set => SetProperty(ref _isVisible, value);
    }

    public int Size
    {
        get => _size;
        private set => SetProperty(ref _size, value);
    }

    public string Status
    {
        get => _status;
        private set => SetProperty(ref _status, value);
    }

    public ObservableCollection<GridCellViewModel> Cells { get; } = new();

    public ICommand CellCommand => _cellCommand;

    public void RefreshCanExecute() => _cellCommand.RaiseCanExecuteChanged();

    public void SyncFromState(GameStateDto state, int? viewerPlayerId)
    {
        SyncFromStateCore(state, viewerPlayerId);
    }

    private sealed record GridAction(string Type, string Label, System.Text.Json.JsonElement Payload, bool HasOrientation);
}
