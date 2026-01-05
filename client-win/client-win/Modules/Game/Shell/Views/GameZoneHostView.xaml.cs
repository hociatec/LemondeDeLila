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
            // Si aucun enfant focusable, garder le focus sur le root du jeu plutôt que sur l'ancre,
            // pour éviter que les flèches ré-annoncent le titre (NVDA) en restant bloquées sur l'ancre.
            if (contentRoot.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)))
            {
                return;
            }

            if (contentRoot.Focusable || contentRoot.IsTabStop)
            {
                if (contentRoot.Focus())
                {
                    Keyboard.Focus(contentRoot);
                    return;
                }
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
