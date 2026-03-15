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
    internal static bool IsRepeatSensitiveActionKey(Key key)
    {
        if (key is Key.Enter or Key.Return or Key.Space or Key.Back)
        {
            return true;
        }

        if (key is >= Key.A and <= Key.Z)
        {
            return true;
        }

        if (key is >= Key.D0 and <= Key.D9)
        {
            return true;
        }

        return false;
    }

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

        if (e.IsRepeat)
        {
            e.Handled = true;
            return;
        }

        if (DataContext is not GamePlayViewModel vm ||
            (vm.Grid.IsVisible && !vm.IsChoosePawnPending))
        {
            return;
        }

        if (IsGameFinished(vm))
        {
            return;
        }

        if (sender is ListBox list && ReferenceEquals(list, HandList) && HandList.IsVisible && HandList.Items.Count > 0)
        {
            // Enter on hand must never bubble to default ListBox behavior or global shortcuts.
            e.Handled = true;
            try
            {
                var selectedHandCard = HandList.SelectedItem as GamePlayViewModel.HandCardLine;
                if (selectedHandCard?.Disabled == true)
                {
                    // Silent ignore for unplayable cards.
                    return;
                }

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
                        e.Handled = true;
                        // Hand-driven flow (LAMA, etc.): keep focus anchored on hand list.
                        NoteHandSubmittedForFocusRestore();
                        return;
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
            try
            {
                var sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    e.Handled = true;
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

        if (DataContext is GamePlayViewModel vm &&
            vm.Grid.IsVisible &&
            !vm.IsChoosePawnPending)
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

    private void OnInteractiveListGotKeyboardFocus(object sender, KeyboardFocusChangedEventArgs e)
    {
        if (sender is not ListBox list || list.Items.Count <= 0 || !list.IsVisible)
        {
            return;
        }

        // Tab/Maj+Tab peut d'abord poser le focus sur la ListBox elle-même.
        // Dans ce cas, ancrer immédiatement sur l'item sélectionné (ou le premier).
        if (ReferenceEquals(e.OriginalSource, list))
        {
            var idx = ReferenceEquals(list, HandList)
                ? 0
                : list.SelectedIndex;

            if (idx < 0)
            {
                idx = 0;
            }
            if (idx >= list.Items.Count)
            {
                idx = list.Items.Count - 1;
            }

            list.SelectedIndex = idx;
            list.ScrollIntoView(list.Items[idx]);
            TryFocusChoiceIndex(list, idx);
        }
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

    private bool IsFocusWithinGamePlay()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        return focused != null && IsDescendantOrSelf(focused, this);
    }

    private static bool IsDescendantOrSelf(DependencyObject node, DependencyObject ancestor)
    {
        for (var current = node; current != null; current = GetVisualParent(current))
        {
            if (ReferenceEquals(current, ancestor))
            {
                return true;
            }
        }

        return false;
    }

    private static DependencyObject? GetVisualParent(DependencyObject current)
    {
        if (current == null)
        {
            return null;
        }

        try
        {
            if (current is Visual || current is System.Windows.Media.Media3D.Visual3D)
            {
                return VisualTreeHelper.GetParent(current);
            }
        }
        catch
        {
            // ignore
        }

        if (current is FrameworkElement fe)
        {
            return fe.Parent ?? fe.TemplatedParent;
        }

        return LogicalTreeHelper.GetParent(current);
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

        if (e.IsRepeat && IsRepeatSensitiveActionKey(e.Key))
        {
            e.Handled = true;
            return;
        }

        if (DataContext is not GamePlayViewModel vm)
        {
            return;
        }

        if (!(vm.IsChoosePawnPending && ChoicesList.IsVisible && ChoicesList.Items.Count > 0))
        {
            HandleGridArrowKey(e);
        }
        if (e.Handled)
        {
            return;
        }

        var isFinishedState = IsGameFinished(vm);

        if (!isFinishedState &&
            (Keyboard.Modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) == ModifierKeys.None &&
            e.Key == Key.D &&
            !vm.Grid.IsVisible &&
            HandList.IsVisible &&
            HandList.Items.Count > 0 &&
            string.Equals(vm.GameId, "cat-pattes", StringComparison.OrdinalIgnoreCase) &&
            IsFocusWithinGamePlay())
        {
            try
            {
                var handled = await vm.DiscardSelectedHandCardAsync(CancellationToken.None).ConfigureAwait(true);
                if (handled)
                {
                    e.Handled = true;
                    NoteHandSubmittedForFocusRestore();
                    return;
                }
            }
            catch
            {
                // ignore
            }
        }

        // UX clavier (ex: LAMA) : la main extra (pas les choix de pending) prend la priorité.
        if ((e.Key == Key.Enter || e.Key == Key.Return) &&
            !isFinishedState &&
            !vm.IsChoosePawnPending &&
            HandList.IsVisible &&
            HandList.Items.Count > 0 &&
            (!vm.Grid.IsVisible || vm.IsChoosePawnPending))
        {
            // Enter on hand is local-only: consume it even when no action is sent.
            e.Handled = true;
            try
            {
                var selectedHandCard = HandList.SelectedItem as GamePlayViewModel.HandCardLine;
                if (selectedHandCard?.Disabled == true)
                {
                    // Silent ignore for unplayable cards.
                    return;
                }

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
                        e.Handled = true;
                        // Hand-driven flow (LAMA, etc.): keep focus anchored on hand list.
                        NoteHandSubmittedForFocusRestore();
                        return;
                    }
                }
            }
            catch
            {
                // ignore
            }
            // No local hand/choice action was sent: keep it as silent no-op.
            return;
        }

        // UX clavier (ex: LAMA) : si la liste de main/choix est affichée, Entrée valide le choix sélectionné
        // même si le focus n'est pas déjà dans la ListBox (on navigue souvent via ↑/↓ depuis la zone de jeu).
        if ((e.Key == Key.Enter || e.Key == Key.Return) &&
            !isFinishedState &&
            ChoicesList.IsVisible &&
            ChoicesList.Items.Count > 0 &&
            (!vm.Grid.IsVisible || vm.IsChoosePawnPending))
        {
            try
            {
                var sent = await vm.SubmitSelectedChoiceAsync(CancellationToken.None).ConfigureAwait(true);
                if (sent)
                {
                    e.Handled = true;
                    NoteChoiceSubmittedForFocusRestore(vm);
                    return;
                }
            }
            catch
            {
                // ignore
            }
            // No local choice action sent: allow ENTER fallback to server shortcut handling.
        }

        var status = (vm.Session?.LastState?.Status ?? string.Empty).Trim();
        var isStartedState = string.Equals(status, "started", StringComparison.OrdinalIgnoreCase);

        // Grille (jeu démarré): laisser Entrée/Espace activer la case (Button.Command) au lieu de renvoyer une touche "ENTER" au serveur.
        // Sinon Corridor (prendre le pion / déplacement / pose de mur) devient inutilisable.
        // En setup/config: ne pas "manger" Entrée, elle doit pouvoir relancer la config/démarrage côté serveur.
        if (isStartedState &&
            !isFinishedState &&
            vm.Grid.IsVisible &&
            vm.Grid.HasAnyGridAction &&
            IsFocusWithinGrid() &&
            (e.Key == Key.Enter || e.Key == Key.Return || e.Key == Key.Space))
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
            FocusPreferredInteractiveElement(forceFromOutsideTextInput: false);
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

    private static bool IsGameFinished(GamePlayViewModel vm)
    {
        if (vm == null)
        {
            return false;
        }

        var status = vm.Session?.LastState?.Status;
        var normalized = (status ?? string.Empty).Trim();
        return string.Equals(normalized, "finished", StringComparison.OrdinalIgnoreCase);
    }
}
