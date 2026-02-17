using System;
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
}
