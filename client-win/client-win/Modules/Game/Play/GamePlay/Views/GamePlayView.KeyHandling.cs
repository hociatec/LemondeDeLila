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

    private async void OnChoicesPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (TryHandleHandNavigation(e))
        {
            return;
        }

        if (e.Key is not (Key.Enter or Key.Return))
        {
            return;
        }

        if (DataContext is not GamePlayViewModel vm || vm.Grid.IsVisible)
        {
            return;
        }

        if (sender is ListBox list && ReferenceEquals(list, HandList) && HandList.IsVisible && HandList.Items.Count > 0)
        {
            e.Handled = true;
            try
            {
                var sent = await vm.SubmitSelectedHandCardAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    NoteHandSubmittedForFocusRestore();
                    return;
                }

                // LAMA and similar flows expose actionable cards via pending choices (not select_card).
                // Fallback: align list selection and submit the corresponding pending choice.
                if (ChoicesList.Items.Count > 0)
                {
                    var idx = HandList.SelectedIndex;
                    if (idx < 0) idx = 0;
                    if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
                    if (idx >= 0)
                    {
                        ChoicesList.SelectedIndex = idx;
                    }

                    var sentChoice = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                    if (sentChoice)
                    {
                        // Hand-driven flow (LAMA, etc.): keep focus anchored on hand list.
                        NoteHandSubmittedForFocusRestore();
                    }
                }
            }
            catch
            {
                // ignore
            }
            return;
        }

        if (sender is ListBox choiceList && ReferenceEquals(choiceList, ChoicesList) && ChoicesList.Items.Count > 0)
        {
            e.Handled = true;
            try
            {
                var sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    NoteChoiceSubmittedForFocusRestore(vm);
                }
            }
            catch
            {
                // ignore
            }
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

        ListBox? targetList = null;
        if (DataContext is GamePlayViewModel vmChoosePawn &&
            vmChoosePawn.IsChoosePawnPending &&
            ChoicesList.IsVisible &&
            ChoicesList.Items.Count > 0)
        {
            targetList = ChoicesList;
        }
        else if (HandList.IsVisible && HandList.Items.Count > 0)
        {
            targetList = HandList;
        }
        else if (ChoicesList.IsVisible && ChoicesList.Items.Count > 0)
        {
            targetList = ChoicesList;
        }

        if (targetList == null)
        {
            return false;
        }

        // Naviguer la liste même si le focus est ailleurs (Tab/Maj+Tab, historique, etc.).
        e.Handled = true;

        var count = targetList.Items.Count;
        var current = targetList.SelectedIndex;
        var delta = e.Key == Key.Up ? -1 : 1;
        var wasFocusWithinTarget = targetList.IsKeyboardFocusWithin;
        int next;
        if (current < 0) current = 0;
        next = current + delta;
        if (next < 0) next = 0;
        if (next >= count) next = count - 1;

        // Borne haute/basse: ne pas "reboucler" visuellement/sonorement.
        // Si la liste est déjà focusée, on consomme la touche sans re-focaliser le même item.
        if (next == current && wasFocusWithinTarget)
        {
            return true;
        }

        targetList.SelectedIndex = next;
        targetList.ScrollIntoView(targetList.Items[next]);

        TryFocusChoiceIndex(targetList, next);

        return true;
    }

    private void TryFocusChoiceIndex(ListBox list, int index)
    {
        if (list == null || !list.IsVisible || list.Items.Count <= 0)
        {
            return;
        }

        if (index < 0 || index >= list.Items.Count)
        {
            index = 0;
        }

        if (TryFocusListBoxIndexNow(list, index))
        {
            return;
        }

        // Retry without forcing layout (UpdateLayout can freeze during frequent state refreshes).
        if (ReferenceEquals(list, HandList))
        {
            RequestFocusHandListIndex(index);
        }
        else
        {
            RequestFocusChoiceListIndex(index);
        }
    }

    private void TryFocusChoiceIndex(int index) =>
        TryFocusChoiceIndex(ChoicesList, index);

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

    private bool TryFocusHandOrChoicesList()
    {
        if (DataContext is GamePlayViewModel vmChoosePawn &&
            vmChoosePawn.IsChoosePawnPending &&
            ChoicesList.IsVisible &&
            ChoicesList.Items.Count > 0)
        {
            var idx = ChoicesList.SelectedIndex;
            if (idx < 0) idx = 0;
            if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
            ChoicesList.SelectedIndex = idx;
            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
            TryFocusChoiceIndex(ChoicesList, idx);
            return true;
        }

        if (HandList.IsVisible && HandList.Items.Count > 0)
        {
            var idx = HandList.SelectedIndex;
            if (idx < 0) idx = 0;
            if (idx >= HandList.Items.Count) idx = HandList.Items.Count - 1;
            HandList.SelectedIndex = idx;
            HandList.ScrollIntoView(HandList.SelectedItem);
            TryFocusChoiceIndex(HandList, idx);
            return true;
        }

        if (ChoicesList.IsVisible && ChoicesList.Items.Count > 0)
        {
            var idx = ChoicesList.SelectedIndex;
            if (idx < 0) idx = 0;
            if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
            ChoicesList.SelectedIndex = idx;
            ChoicesList.ScrollIntoView(ChoicesList.SelectedItem);
            TryFocusChoiceIndex(ChoicesList, idx);
            return true;
        }

        return false;
    }

    private async void OnRootPreviewKeyDown(object sender, KeyEventArgs e)
    {
        // Routed events: si une couche plus haute (ex: ShortcutBindingsBehavior) a déjà consommé la touche,
        // ne pas la retraiter ici (sinon double envoi/annonces doublées).
        if (e.Handled)
        {
            return;
        }

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

        if (e.Key == Key.Tab)
        {
            // Laisser WPF gérer Tab/Maj+Tab pour permettre l'accès à l'historique et au chat.
            // La capture de focus reste active uniquement pendant un prompt inline (bloc plus haut).
            return;
        }

        // ESC: do nothing locally. Previously we used it as a "reset focus" which made screen readers
        // re-announce the root/hand controls on every press or during frequent state refreshes (bot turns).
        // The inline prompt overlay still handles ESC separately (cancel) when visible.
        if (e.Key == Key.Escape)
        {
            // No-op by design. Mark handled to prevent parent/shell handlers from moving focus
            // outside the game area and leaving users on an empty/unstable zone.
            e.Handled = true;
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

        // UX clavier (ex: LAMA) : la main extra (pas les choix de pending) prend la priorité.
        if ((e.Key == Key.Enter || e.Key == Key.Return) &&
            !vm.IsChoosePawnPending &&
            HandList.IsVisible &&
            HandList.Items.Count > 0 &&
            !vm.Grid.IsVisible)
        {
            e.Handled = true;
            try
            {
                var sent = await vm.SubmitSelectedHandCardAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    NoteHandSubmittedForFocusRestore();
                    return;
                }

                // LAMA: cards are submitted via pending choices (lama_play), not select_card.
                if (ChoicesList.Items.Count > 0)
                {
                    var idx = HandList.SelectedIndex;
                    if (idx < 0) idx = 0;
                    if (idx >= ChoicesList.Items.Count) idx = ChoicesList.Items.Count - 1;
                    if (idx >= 0)
                    {
                        ChoicesList.SelectedIndex = idx;
                    }

                    var sentChoice = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                    if (sentChoice)
                    {
                        // Hand-driven flow (LAMA, etc.): keep focus anchored on hand list.
                        NoteHandSubmittedForFocusRestore();
                    }
                }
            }
            catch
            {
                // ignore
            }
            return;
        }

        // UX clavier (ex: LAMA) : si la liste de main/choix est affichée, Entrée valide le choix sélectionné
        // même si le focus n'est pas déjà dans la ListBox (on navigue souvent via ↑/↓ depuis la zone de jeu).
        if ((e.Key == Key.Enter || e.Key == Key.Return) &&
            ChoicesList.IsVisible &&
            ChoicesList.Items.Count > 0 &&
            !vm.Grid.IsVisible)
        {
            e.Handled = true;
            try
            {
                var sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    NoteChoiceSubmittedForFocusRestore(vm);
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
            if (ChoicesList.IsVisible && IsFocusWithinChoices())
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
                if (await vm.TryHandleInterfaceShortcutLocallyAsync(key, CancellationToken.None).ConfigureAwait(true))
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
            // Only special-case Shift+I for server-side "inventory_all" without breaking
            // existing single-letter shortcuts (Shift is commonly held for uppercase).
            if (key == Key.I && (Keyboard.Modifiers & ModifierKeys.Shift) != ModifierKeys.None)
            {
                normalized = "SHIFT+I";
                return true;
            }

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
