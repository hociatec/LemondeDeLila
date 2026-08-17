using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Modules.Game.Play.GamePlay.Views;
using client_win.Modules.Game.Shell.Models;
using client_win.Modules.Game.Shell.Services;
using client_win.Modules.Game.Shell.ViewModels;
using client_win.Modules.Shell.Services;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameRoomView : UserControl, IInitialFocusTarget, IGameFocusHost
{
    private static readonly TimeSpan RapidTabRecoveryWindow = TimeSpan.FromMilliseconds(300);
    private GameRoomViewModel? _vm;
    private IDisposable? _focusHostLease;
    private IScreenReaderAnnouncer? _screenReader;
    private GameRoomFocusPolicy? _focusPolicy;
    private Action? _historyFocusedUpdateHandler;
    private KeyEventHandler? _rootTabHandler;
    private DateTime _lastTabCycleAtUtc;
    private TabTargetKind? _lastTabCycleTargetKind;

    public GameRoomView()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
        DataContextChanged += OnDataContextChanged;
    }

}
