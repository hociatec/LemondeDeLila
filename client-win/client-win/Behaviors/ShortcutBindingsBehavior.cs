using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;
using client_win.Core.Diagnostics;
using client_win.Core.Input;
using client_win.Modules.Game.Shell.Views;

namespace client_win.Behaviors;

public static class ShortcutBindingsBehavior
{
    public static readonly DependencyProperty ShortcutsProperty = DependencyProperty.RegisterAttached(
        "Shortcuts",
        typeof(IEnumerable<ShortcutDefinition>),
        typeof(ShortcutBindingsBehavior),
        new PropertyMetadata(null, OnShortcutsChanged));

    public static void SetShortcuts(DependencyObject element, IEnumerable<ShortcutDefinition> value) =>
        element.SetValue(ShortcutsProperty, value);

    public static IEnumerable<ShortcutDefinition>? GetShortcuts(DependencyObject element) =>
        element.GetValue(ShortcutsProperty) as IEnumerable<ShortcutDefinition>;

    public static readonly DependencyProperty DisableWhenFocusWithinProperty = DependencyProperty.RegisterAttached(
        "DisableWhenFocusWithin",
        typeof(bool),
        typeof(ShortcutBindingsBehavior),
        new PropertyMetadata(false));

    public static void SetDisableWhenFocusWithin(DependencyObject element, bool value) =>
        element.SetValue(DisableWhenFocusWithinProperty, value);

    public static bool GetDisableWhenFocusWithin(DependencyObject element) =>
        (bool)element.GetValue(DisableWhenFocusWithinProperty);

    public static readonly DependencyProperty RefocusAfterExecuteProperty = DependencyProperty.RegisterAttached(
        "RefocusAfterExecute",
        typeof(bool),
        typeof(ShortcutBindingsBehavior),
        new PropertyMetadata(false));

    public static void SetRefocusAfterExecute(DependencyObject element, bool value) =>
        element.SetValue(RefocusAfterExecuteProperty, value);

    public static bool GetRefocusAfterExecute(DependencyObject element) =>
        (bool)element.GetValue(RefocusAfterExecuteProperty);

    private sealed class Subscription
    {
        public INotifyCollectionChanged? Collection { get; set; }
        public NotifyCollectionChangedEventHandler? Handler { get; set; }
        public KeyEventHandler? PreviewKeyDownHandler { get; set; }
        public bool PreviewKeyDownAttached { get; set; }
    }

    private static readonly ConditionalWeakTable<UIElement, Subscription> _subscriptions = new();

    private static void OnShortcutsChanged(DependencyObject d, DependencyPropertyChangedEventArgs e)
    {
        if (d is not UIElement element)
        {
            return;
        }

        if (_subscriptions.TryGetValue(element, out var previous))
        {
            Unsubscribe(element, previous);
        }

        var next = new Subscription();
        _subscriptions.Remove(element);
        _subscriptions.Add(element, next);

        Apply(element, next, e.NewValue as IEnumerable<ShortcutDefinition>);
    }

    private static void Unsubscribe(UIElement element, Subscription subscription)
    {
        if (subscription.Collection != null && subscription.Handler != null)
        {
            subscription.Collection.CollectionChanged -= subscription.Handler;
        }
        subscription.Collection = null;
        subscription.Handler = null;

        if (subscription.PreviewKeyDownHandler != null)
        {
            try
            {
                if (subscription.PreviewKeyDownAttached)
                {
                    element.RemoveHandler(Keyboard.PreviewKeyDownEvent, subscription.PreviewKeyDownHandler);
                }
                else
                {
                    element.PreviewKeyDown -= subscription.PreviewKeyDownHandler;
                }
            }
            catch
            {
                // best-effort
            }
            subscription.PreviewKeyDownHandler = null;
            subscription.PreviewKeyDownAttached = false;
        }
    }

    private static void Apply(UIElement element, Subscription subscription, IEnumerable<ShortcutDefinition>? shortcuts)
    {
        Unsubscribe(element, subscription);

        if (shortcuts == null)
        {
            return;
        }

        var gestureShortcuts = shortcuts.Where(s => s.Gesture != null).ToList();
        var charShortcuts = shortcuts.Where(s => s.Key != null).ToList();
        if (gestureShortcuts.Count > 0 || charShortcuts.Count > 0)
        {
            subscription.PreviewKeyDownHandler = (_, e) =>
            {
                if (e.Handled)
                {
                    ShortcutDiagnostics.TryLog("shortcut.skip reason=handled");
                    return;
                }

                // Ne pas interpréter les raccourcis quand le focus est dans un contrôle de texte
                // (ex: historique en lecture seule). On laisse le contrôle/lecteur d'écran gérer l'écho clavier.
                if (IsTextInputFocused())
                {
                    ShortcutDiagnostics.TryLog("shortcut.skip reason=text_input_focused");
                    return;
                }

                if (IsDisabledForFocusedElement())
                {
                    ShortcutDiagnostics.TryLog("shortcut.skip reason=disabled_when_focus_within");
                    return;
                }

                var shouldRefocus = GetRefocusAfterExecute(element) && IsKeyboardFocusInGameZone();
                var key = e.Key == Key.System ? e.SystemKey : e.Key;
                var modifiers = Keyboard.Modifiers;

                // 1) Gestures (ex: Enter) : gérées ici pour respecter DisableWhenFocusWithin / text inputs.
                if (gestureShortcuts.Count > 0)
                {
                    // Ne pas intercepter Enter quand l'utilisateur est dans une liste de choix (quiz/échange),
                    // afin de laisser le contrôle consommer Enter pour "valider" la sélection.
                    if (!(key == Key.Enter && IsSelectorFocused()))
                    {
                        foreach (var shortcut in gestureShortcuts)
                        {
                            var gesture = shortcut.Gesture;
                            if (gesture == null) continue;
                            if (gesture.Key != key) continue;
                            if (gesture.Modifiers != modifiers) continue;

                            ShortcutDiagnostics.TryLog($"shortcut.match kind=gesture key={key} mods={modifiers} code={shortcut.Code ?? ""}");
                            if (shortcut.Command.CanExecute(shortcut.CommandParameter))
                            {
                                shortcut.Command.Execute(shortcut.CommandParameter);
                                var code = shortcut.Code ?? string.Empty;
                                var isGameShortcut =
                                    code.StartsWith("ui.", StringComparison.OrdinalIgnoreCase) ||
                                    code.StartsWith("game.", StringComparison.OrdinalIgnoreCase);
                                e.Handled = isGameShortcut;
                                if (shouldRefocus)
                                {
                                    RequestRefocusGameZone(element);
                                }
                            }
                            return;
                        }
                    }
                }

                // 2) Char shortcuts
                if (charShortcuts.Count == 0)
                {
                    ShortcutDiagnostics.TryLog("shortcut.skip reason=no_char_shortcuts");
                    return;
                }

                // Les raccourcis "char" supportent:
                // - aucune touche modificatrice (ex: q)
                // - Maj seule, pour distinguer b / B sans passer par KeyGesture (qui ne supporte pas Shift+Lettre)
                var hasCtrlAltWin = (modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != ModifierKeys.None;
                if (hasCtrlAltWin)
                {
                    ShortcutDiagnostics.TryLog("shortcut.skip reason=ctrl_alt_win_for_char");
                    return;
                }

                var shift = (modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
                var capsLock = Keyboard.IsKeyToggled(Key.CapsLock);
                var upper = shift ^ capsLock;
                char? typed = KeyToChar(key, upper);
                if (typed == null)
                {
                    ShortcutDiagnostics.TryLog($"shortcut.skip reason=key_to_char_null key={key} mods={modifiers}");
                    return;
                }

                foreach (var shortcut in charShortcuts)
                {
                    if (shortcut.Key == null) continue;
                    if (shortcut.Key.Value != typed.Value) continue;

                    ShortcutDiagnostics.TryLog($"shortcut.match kind=char typed={typed.Value} code={shortcut.Code ?? ""}");
                    if (shortcut.Command.CanExecute(shortcut.CommandParameter))
                    {
                        shortcut.Command.Execute(shortcut.CommandParameter);
                        // Par défaut, on laisse passer la touche pour permettre l'annonce (key echo) du lecteur d'écran.
                        // Exception: certains raccourcis doivent annoncer un message immédiatement après, et l'écho clavier
                        // arrive souvent après (ordre inversé). Pour ces cas, on consomme la touche et on annonce via NVDA.
                        var code = shortcut.Code ?? string.Empty;
                        // Ne pas consommer la touche : laisser le lecteur d'écran faire l'écho clavier naturellement.
                        // Exception: les raccourcis "server.key.*" sont aussi renvoyés par GamePlayView => double envoi.
                        e.Handled = code.StartsWith("server.key.", StringComparison.OrdinalIgnoreCase);
                        if (shouldRefocus)
                        {
                            RequestRefocusGameZone(element);
                        }
                    }
                    return;
                }

                // Fallback: si aucune touche n'a matché exactement (ex: serveur "pressed D", user en CapsLock),
                // on autorise un match insensible à la casse, tant qu'il n'existe pas deux raccourcis explicites
                // (ex: b/B) qui nécessitent une distinction.
                if (char.IsLetter(typed.Value))
                {
                    var lower = char.ToLowerInvariant(typed.Value);
                    var upperExactExists = charShortcuts.Any(s => s.Key == char.ToUpperInvariant(lower));
                    var lowerExactExists = charShortcuts.Any(s => s.Key == lower);

                    // Si les 2 variantes existent, l'utilisateur doit utiliser la bonne casse (b vs B).
                    if (!(upperExactExists && lowerExactExists))
                    {
                        foreach (var shortcut in charShortcuts)
                        {
                            if (shortcut.Key == null) continue;
                            if (!char.IsLetter(shortcut.Key.Value)) continue;
                            if (char.ToLowerInvariant(shortcut.Key.Value) != lower) continue;

                            if (shortcut.Command.CanExecute(shortcut.CommandParameter))
                            {
                                shortcut.Command.Execute(shortcut.CommandParameter);
                                var code = shortcut.Code ?? string.Empty;
                                // Voir commentaire plus haut sur server.key.* (double envoi).
                                e.Handled = code.StartsWith("server.key.", StringComparison.OrdinalIgnoreCase);
                                if (shouldRefocus)
                                {
                                    RequestRefocusGameZone(element);
                                }
                            }
                            return;
                        }
                    }
                }
            };

            // IMPORTANT: use handledEventsToo to make shortcuts reliable even if a child control marks the event handled.
            // This prevents "1 fois sur 3" behavior depending on focus or control-specific handlers.
            try
            {
                element.AddHandler(Keyboard.PreviewKeyDownEvent, subscription.PreviewKeyDownHandler, handledEventsToo: true);
                subscription.PreviewKeyDownAttached = true;
            }
            catch
            {
                // Fallback: legacy event hookup.
                element.PreviewKeyDown += subscription.PreviewKeyDownHandler;
                subscription.PreviewKeyDownAttached = false;
            }
        }

        if (shortcuts is INotifyCollectionChanged notify)
        {
            var weakElement = new WeakReference<UIElement>(element);
            NotifyCollectionChangedEventHandler? handler = null;
            handler = (_, __) =>
            {
                if (!weakElement.TryGetTarget(out var target))
                {
                    if (handler != null)
                    {
                        notify.CollectionChanged -= handler;
                    }
                    return;
                }

                if (_subscriptions.TryGetValue(target, out var current))
                {
                    Apply(target, current, GetShortcuts(target));
                }
            };
            subscription.Collection = notify;
            subscription.Handler = handler;
            notify.CollectionChanged += handler;
        }
    }

    private static char? KeyToChar(Key key, bool upper)
    {
        if (key >= Key.A && key <= Key.Z)
        {
            int offset = key - Key.A;
            return (char)((upper ? 'A' : 'a') + offset);
        }
        return null;
    }

    private static bool IsKeyboardFocusInGameZone()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        // Le focus peut être sur:
        // - un contrôle de jeu dynamique (contenu) sous GameZoneHostView
        // - une ancre de focus GameZoneFocusAnchor
        // - la surface GamePlayView
        for (DependencyObject? current = focused; current != null; current = GetParent(current))
        {
            if (current is GameZoneHostView)
            {
                return true;
            }
        }

        return false;
    }

    private static void RequestRefocusGameZone(UIElement element)
    {
        if (IsTextInputFocused())
        {
            return;
        }

        var weak = new WeakReference<UIElement>(element);
        element.Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, new Action(() =>
        {
            if (!weak.TryGetTarget(out var target))
            {
                return;
            }

            if (IsTextInputFocused())
            {
                return;
            }

            // Si l'élément n'est plus dans l'arbre visuel (navigation), ne pas forcer le focus.
            if (target is Visual v && PresentationSource.FromVisual(v) == null)
            {
                return;
            }

            // Priorité: remonter sur la vue de salle et demander explicitement le focus zone de jeu.
            if (FindAncestor<GameRoomView>(target as DependencyObject) is GameRoomView room)
            {
                room.RequestFocusGameZone();
                return;
            }

            // Fallback: chercher une zone de jeu sous l'élément.
            if (FindDescendant<GameZoneHostView>(target as DependencyObject) is GameZoneHostView zone)
            {
                zone.FocusGameZone();
            }
        }));
    }

    private static T? FindAncestor<T>(DependencyObject? current) where T : class
    {
        for (DependencyObject? node = current; node != null; node = GetParent(node))
        {
            if (node is T found)
            {
                return found;
            }
        }
        return null;
    }

    private static T? FindDescendant<T>(DependencyObject? current) where T : class
    {
        if (current == null)
        {
            return null;
        }

        var queue = new Queue<DependencyObject>();
        queue.Enqueue(current);

        while (queue.Count > 0)
        {
            var node = queue.Dequeue();
            if (node is T found)
            {
                return found;
            }

            int count = 0;
            try
            {
                count = VisualTreeHelper.GetChildrenCount(node);
            }
            catch
            {
                // ignore
            }

            for (int i = 0; i < count; i++)
            {
                DependencyObject? child = null;
                try
                {
                    child = VisualTreeHelper.GetChild(node, i);
                }
                catch
                {
                    // ignore
                }

                if (child != null)
                {
                    queue.Enqueue(child);
                }
            }
        }

        return null;
    }

    private static bool IsTextInputFocused()
    {
        var focused = Keyboard.FocusedElement;
        if (focused is null)
        {
            return false;
        }

        if (focused is TextBox tb)
        {
            // Les TextBox en lecture seule (ex: historique de partie) ne sont pas un "input" :
            // on autorise les raccourcis globaux, et seuls les champs éditables bloquent les raccourcis.
            return !tb.IsReadOnly;
        }

        if (focused is PasswordBox)
        {
            return true;
        }

        if (focused is RichTextBox rtb)
        {
            return !rtb.IsReadOnly;
        }

        if (focused is ComboBox combo && combo.IsEditable)
        {
            return true;
        }

        return false;
    }

    private static bool IsSelectorFocused()
    {
        var focused = Keyboard.FocusedElement;
        if (focused is null)
        {
            return false;
        }

        if (focused is System.Windows.Controls.Primitives.Selector)
        {
            return true;
        }

        if (focused is DependencyObject dep)
        {
            for (DependencyObject? current = dep; current != null; current = GetParent(current))
            {
                if (current is System.Windows.Controls.Primitives.Selector)
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsDisabledForFocusedElement()
    {
        var focused = Keyboard.FocusedElement as DependencyObject;
        if (focused == null)
        {
            return false;
        }

        for (DependencyObject? current = focused; current != null; current = GetParent(current))
        {
            if (GetDisableWhenFocusWithin(current))
            {
                return true;
            }
        }

        return false;
    }

    private static DependencyObject? GetParent(DependencyObject current)
    {
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
}
