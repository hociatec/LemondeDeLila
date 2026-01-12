using System.Threading;
using System.Windows;
using System.Windows.Input;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private bool IsFocusWithinChoices()
    {
        if (ChoicesList == null)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, ChoicesList))
            {
                return true;
            }

            focused = System.Windows.Media.VisualTreeHelper.GetParent(focused);
        }

        return false;
    }

    private bool IsFocusWithinGrid()
    {
        if (GridBoard == null)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, GridBoard) || ReferenceEquals(focused, GridItems))
            {
                return true;
            }

            if (focused is FrameworkElement fe)
            {
                if (ReferenceEquals(fe.Parent, GridBoard) || ReferenceEquals(fe.TemplatedParent, GridBoard))
                {
                    return true;
                }
            }

            focused = System.Windows.Media.VisualTreeHelper.GetParent(focused);
        }

        return false;
    }

    private async void OnRootPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (IsTextInputFocused())
        {
            return;
        }

        HandleGridArrowKey(e);
        if (e.Handled)
        {
            return;
        }

        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        // Liste de choix (pending): laisser Entrée valider le choix localement (OnChoicesKeyDown),
        // au lieu d'envoyer "ENTER" au serveur (qui ne résout pas un pending choose_*).
        if (ChoicesList.Visibility == Visibility.Visible &&
            IsFocusWithinChoices() &&
            (e.Key == Key.Enter || e.Key == Key.Return))
        {
            return;
        }

        // Grille: laisser Entrée/Espace activer la case (Button.Command) au lieu de renvoyer une touche "ENTER" au serveur.
        // Sinon Corridor (prendre le pion / déplacement / pose de mur) devient inutilisable.
        if (vm.Grid.IsVisible && IsFocusWithinGrid() && (e.Key == Key.Enter || e.Key == Key.Return || e.Key == Key.Space))
        {
            return;
        }

        // Empêche la navigation directionnelle WPF (flèches) de "sortir" du jeu et de casser l'interaction
        // après un Tab/Maj+Tab : on garde/ramène le focus sur une ancre stable dans la zone de jeu.
        if (e.Key is Key.Left or Key.Right or Key.Up or Key.Down)
        {
            if (ChoicesList.Visibility == Visibility.Visible && IsFocusWithinChoices())
            {
                return;
            }

            e.Handled = true;
            ForceFocusGameZone();
            return;
        }

        // Client as a bridge: forward key presses to the server; the server decides if it's a shortcut.
        if ((Keyboard.Modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != ModifierKeys.None)
        {
            return;
        }

        // Grille: 'M' est un raccourci UI local (liste d'actions de la case), pas une touche envoyée au serveur.
        if (e.Key == Key.M && vm.Grid.IsVisible)
        {
            return;
        }

        if (!TryMapKeyToServerShortcut(e.Key, out var key))
        {
            return;
        }

        e.Handled = true;
        try
        {
            await vm.TrySendKeyAsync(key, CancellationToken.None).ConfigureAwait(true);
        }
        catch
        {
            // ignore
        }
    }

    private static bool TryMapKeyToServerShortcut(Key key, out string normalized)
    {
        normalized = string.Empty;

        if (key is >= Key.A and <= Key.Z)
        {
            normalized = key.ToString().ToUpperInvariant();
            return true;
        }

        if (key is >= Key.D0 and <= Key.D9)
        {
            var digit = (int)key - (int)Key.D0;
            normalized = digit.ToString();
            return true;
        }

        // Common non-letter shortcuts.
        normalized = key switch
        {
            Key.Space => "SPACE",
            Key.Enter or Key.Return => "ENTER",
            Key.Back => "BACK",
            Key.Escape => "ESC",
            _ => string.Empty
        };

        return !string.IsNullOrWhiteSpace(normalized);
    }
}
