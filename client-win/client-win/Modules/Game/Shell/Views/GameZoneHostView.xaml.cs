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
        if (GameZoneHost?.Content == null)
        {
            if (GameZoneEmptyAnchor?.Focus() == true)
            {
                Keyboard.Focus(GameZoneEmptyAnchor);
                return;
            }
        }

        if (GameZoneHost?.Content is System.Windows.FrameworkElement contentRoot)
        {
            // Priorité: focus sur un enfant réellement interactif (ex: liste de choix).
            // Si aucun enfant focusable, garder le focus sur le root du jeu plutôt que sur l'ancre,
            // pour éviter que les flèches ré-annoncent le titre (NVDA) en restant bloquées sur l'ancre.
            if (contentRoot.MoveFocus(new TraversalRequest(FocusNavigationDirection.First)))
            {
                return;
            }

            if (contentRoot.Focusable || KeyboardNavigation.GetIsTabStop(contentRoot))
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

        // Les flèches ne doivent pas déplacer le focus depuis l'ancre : la navigation est gérée ailleurs.
        if (e.Key is Key.Left or Key.Right or Key.Up or Key.Down)
        {
            e.Handled = true;
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
