using System;
using System.Threading;
using System.Windows.Controls;
using client_win.Modules.Shell.Views;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView : UserControl, IInitialFocusTarget
{
    public GamePlayView()
    {
        InitializeComponent();
        DataContextChanged += OnDataContextChanged;
        Unloaded += OnUnloaded;
    }

    public void RequestInitialFocus()
    {
        FocusPreferredInteractiveElement();
    }

    public void CancelPendingFocusRecovery()
    {
        Interlocked.Increment(ref _preferredInteractiveFocusRequestId);
        Interlocked.Increment(ref _gameZoneFocusRequestId);
        Interlocked.Increment(ref _postPawnSubmitFocusRequestId);
        Interlocked.Increment(ref _postPawnSelectionRecoveryRequestId);
        _pendingInitialInteractiveFocus = false;
        _postPawnSelectionRecoveryUntilUtc = default;
    }
}
