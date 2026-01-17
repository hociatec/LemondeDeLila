using System.Threading;
using System.Windows;
using System.Windows.Input;
using System.Windows.Controls;
using System;
using System.Windows.Threading;
using System.Windows.Media;
using client_win.Modules.Game.Play.GamePlay.ViewModels;

namespace client_win.Modules.Game.Play.GamePlay.Views;

public partial class GamePlayView
{
    private bool IsFocusWithinInlinePrompt()
    {
        if (InlinePromptOverlay == null)
        {
            return false;
        }

        var focused = Keyboard.FocusedElement as DependencyObject;
        while (focused != null)
        {
            if (ReferenceEquals(focused, InlinePromptOverlay))
            {
                return true;
            }

            focused = VisualTreeHelper.GetParent(focused);
        }

        return false;
    }

    private void OnChoicesPreviewKeyDown(object sender, KeyEventArgs e)
    {
        // Assure un comportement "boucle" pour la main (LAMA) même quand le focus est dans la ListBox.
        if (TryHandleHandNavigation(e))
        {
            return;
        }
    }

    private bool TryHandleHandNavigation(KeyEventArgs e)
    {
        if (e.Key is not (Key.Up or Key.Down))
        {
            return false;
        }

        if (DataContext is GamePlayViewModel vm && vm.Grid.IsVisible)
        {
            return false;
        }

        if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
        {
            return false;
        }

        // Naviguer la liste même si le focus est ailleurs (Tab/Maj+Tab, historique, etc.).
        e.Handled = true;

        var count = ChoicesList.Items.Count;
        var current = ChoicesList.SelectedIndex;
        if (current < 0)
        {
            current = 0;
        }

        var delta = e.Key == Key.Up ? -1 : 1;

        int next;
        if (DataContext is GamePlayViewModel vm2 && vm2.IsQuizPending)
        {
            // Quiz: no wrap-around (top/bottom should be blocked).
            next = current + delta;
            if (next < 0) next = 0;
            if (next >= count) next = count - 1;
        }
        else
        {
            // Other modes (ex: LAMA hand): keep wrap behavior.
            next = (current + delta) % count;
            if (next < 0) next += count;
        }

        ChoicesList.SelectedIndex = next;
        ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);

        TryFocusChoiceIndex(next);

        return true;
    }

    private void TryFocusChoiceIndex(int index)
    {
        if (ChoicesList.Visibility != Visibility.Visible || ChoicesList.Items.Count <= 0)
        {
            return;
        }

        if (index < 0 || index >= ChoicesList.Items.Count)
        {
            index = 0;
        }

        ChoicesList.UpdateLayout();

        if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item)
        {
            item.Focus();
            Keyboard.Focus(item);
            return;
        }

        // Virtualisation: container pas encore créé -> retente après le layout.
        ChoicesList.Focus();
        Keyboard.Focus(ChoicesList);
        Dispatcher.BeginInvoke(DispatcherPriority.Loaded, new Action(() =>
        {
            try
            {
                if (ChoicesList.ItemContainerGenerator.ContainerFromIndex(index) is ListBoxItem item2)
                {
                    item2.Focus();
                    Keyboard.Focus(item2);
                }
            }
            catch
            {
                // ignore
            }
        }));
    }

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

        // Quand un prompt inline est affiché, ne pas intercepter les touches au niveau racine :
        // - laisser Tab naviguer dans le prompt
        // - laisser Entrée/Échap valider/annuler (géré par le prompt)
        // - ne pas forwarder les touches au serveur pendant une saisie
        if (DataContext is GamePlayViewModel promptVm && promptVm.HasInlinePrompt)
        {
            // IMPORTANT: si le focus n'est pas déjà dans le prompt, Tab peut "sortir" de la zone de jeu
            // (historique/chat) et bloquer l'accès à la configuration. On force donc le focus dans le prompt.
            if (e.Key == Key.Tab)
            {
                e.Handled = true;
                if (!IsFocusWithinInlinePrompt())
                {
                    FocusFirstInlinePromptField();
                }
                return;
            }

            if (!IsFocusWithinInlinePrompt() &&
                e.Key is Key.Escape or Key.Enter or Key.Return or Key.Left or Key.Right or Key.Up or Key.Down)
            {
                e.Handled = true;
                FocusFirstInlinePromptField();
                return;
            }

            return;
        }

        // Éviter que Tab/Maj+Tab fasse "sortir" le focus de la zone de jeu, ce qui casse l'UX clavier.
        if (e.Key == Key.Tab)
        {
            e.Handled = true;
            ForceFocusGameZone();
            return;
        }

        // Échap sert de "reset focus" côté client; ne pas l'envoyer au serveur (qui n'a souvent aucun raccourci ESC).
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
            ForceFocusGameZone();
            return;
        }

        if (TryHandleHandNavigation(e))
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

        // UX clavier (ex: LAMA) : si la liste de main/choix est affichée, Entrée valide le choix sélectionné
        // même si le focus n'est pas déjà dans la ListBox (on navigue souvent via ↑/↓ depuis la zone de jeu).
        if ((e.Key == Key.Enter || e.Key == Key.Return) &&
            ChoicesList.Visibility == Visibility.Visible &&
            ChoicesList.Items.Count > 0 &&
            !vm.Grid.IsVisible)
        {
            e.Handled = true;
            try
            {
                var sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    NoteChoiceSubmittedForFocusRestore();
                }
            }
            catch
            {
                // ignore
            }
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
            if (vm.TryHandleInterfaceShortcutLocally(key))
            {
                return;
            }
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
            _ => string.Empty
        };

        return !string.IsNullOrWhiteSpace(normalized);
    }
}
