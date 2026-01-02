using System;
using System.Windows.Controls;
using System.Windows.Input;

namespace client_win.Modules.Game.Shell.Views;

public partial class GameZoneHostView : UserControl
{
    public GameZoneHostView()
    {
        InitializeComponent();
    }

    public event EventHandler? TabToHistoryRequested;
    public event EventHandler? StartRequested;

    public void FocusGameZone()
    {
        if (GameZoneHost?.Content is System.Windows.FrameworkElement contentRoot)
        {
            // Priorité: focus sur un enfant réellement interactif (ex: liste de choix).
            // Fallback: focus sur le root seulement s'il n'y a rien d'autre.
            if (contentRoot.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)))
            {
                return;
            }
        }

        if (GameZoneFocusAnchor?.Focus() == true)
        {
            Keyboard.Focus(GameZoneFocusAnchor);
            return;
        }

        GameZoneEmptyAnchor?.Focus();
        Keyboard.Focus(GameZoneEmptyAnchor);
    }

    private void OnAnchorPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter)
        {
            e.Handled = true;
            StartRequested?.Invoke(this, EventArgs.Empty);
            return;
        }

        if (e.Key != Key.Tab)
        {
            return;
        }

        e.Handled = true;
        TabToHistoryRequested?.Invoke(this, EventArgs.Empty);
    }
}
