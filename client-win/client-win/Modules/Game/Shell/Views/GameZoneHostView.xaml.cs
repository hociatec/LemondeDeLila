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
            // IMPORTANT (UX clavier): garder un focus stable sur la "surface de jeu" (root),
            // sinon WPF peut envoyer le focus dans des contrôles internes (ListBox/TextBox),
            // puis Tab/Enter se comportent de façon inattendue (et le focus "sort" de la zone).
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
