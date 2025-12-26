using System;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Game.Room.Views;

public partial class GameZoneHostView : UserControl
{
    public GameZoneHostView()
    {
        InitializeComponent();
    }

    public event EventHandler? TabToHistoryRequested;

    public void FocusGameZone()
    {
        if (GameZoneHost?.Content is System.Windows.FrameworkElement contentRoot)
        {
            if (contentRoot.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)))
            {
                return;
            }

            if (contentRoot.Focusable && contentRoot.Focus())
            {
                return;
            }
        }

        GameZoneEmptyAnchor?.Focus();
        Keyboard.Focus(GameZoneEmptyAnchor);
    }

    private void OnAnchorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key != Key.Tab)
        {
            return;
        }

        e.Handled = true;
        TabToHistoryRequested?.Invoke(this, EventArgs.Empty);
    }
}
