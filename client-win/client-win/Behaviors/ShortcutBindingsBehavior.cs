using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Core.Input;

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

    private sealed class Subscription
    {
        public List<InputBinding> AddedBindings { get; } = new();
        public INotifyCollectionChanged? Collection { get; set; }
        public NotifyCollectionChangedEventHandler? Handler { get; set; }
        public KeyEventHandler? PreviewKeyDownHandler { get; set; }
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
        foreach (var binding in subscription.AddedBindings)
        {
            element.InputBindings.Remove(binding);
        }
        subscription.AddedBindings.Clear();

        if (subscription.Collection != null && subscription.Handler != null)
        {
            subscription.Collection.CollectionChanged -= subscription.Handler;
        }
        subscription.Collection = null;
        subscription.Handler = null;

        if (subscription.PreviewKeyDownHandler != null)
        {
            element.PreviewKeyDown -= subscription.PreviewKeyDownHandler;
            subscription.PreviewKeyDownHandler = null;
        }
    }

    private static void Apply(UIElement element, Subscription subscription, IEnumerable<ShortcutDefinition>? shortcuts)
    {
        Unsubscribe(element, subscription);

        if (shortcuts == null)
        {
            return;
        }

        foreach (var shortcut in shortcuts)
        {
            if (shortcut.Gesture != null)
            {
                var binding = new KeyBinding(shortcut.Command, shortcut.Gesture)
                {
                    CommandParameter = shortcut.CommandParameter
                };
                element.InputBindings.Add(binding);
                subscription.AddedBindings.Add(binding);
            }
        }

        var charShortcuts = shortcuts.Where(s => s.Key != null).ToList();
        if (charShortcuts.Count > 0)
        {
            subscription.PreviewKeyDownHandler = (_, e) =>
            {
                if (e.Handled)
                {
                    return;
                }

                // Ne pas interpréter les lettres comme raccourcis quand le focus est dans un contrôle de texte
                // (ex: historique en lecture seule). On laisse le contrôle/lecteur d'écran gérer l'écho clavier.
                if (IsTextInputFocused())
                {
                    return;
                }

                if (IsDisabledForFocusedElement())
                {
                    return;
                }

                // Les raccourcis "char" supportent:
                // - aucune touche modificatrice (ex: q)
                // - Maj seule, pour distinguer b / B sans passer par KeyGesture (qui ne supporte pas Shift+Lettre)
                var modifiers = Keyboard.Modifiers;
                var hasCtrlAltWin = (modifiers & (ModifierKeys.Control | ModifierKeys.Alt | ModifierKeys.Windows)) != ModifierKeys.None;
                if (hasCtrlAltWin)
                {
                    return;
                }

                var key = e.Key == Key.System ? e.SystemKey : e.Key;
                var shift = (modifiers & ModifierKeys.Shift) == ModifierKeys.Shift;
                var capsLock = Keyboard.IsKeyToggled(Key.CapsLock);
                var upper = shift ^ capsLock;
                char? typed = KeyToChar(key, upper);
                if (typed == null)
                {
                    return;
                }

                foreach (var shortcut in charShortcuts)
                {
                    if (shortcut.Key == null) continue;
                    if (shortcut.Key.Value != typed.Value) continue;

                    if (shortcut.Command.CanExecute(shortcut.CommandParameter))
                    {
                        shortcut.Command.Execute(shortcut.CommandParameter);
                        // Par défaut, on laisse passer la touche pour permettre l'annonce (key echo) du lecteur d'écran.
                        // Exception: certains raccourcis doivent annoncer un message immédiatement après, et l'écho clavier
                        // arrive souvent après (ordre inversé). Pour ces cas, on consomme la touche et on annonce via NVDA.
                        var code = shortcut.Code ?? string.Empty;
                        var isGameShortcut = code.StartsWith("ui.", StringComparison.OrdinalIgnoreCase) ||
                                             code.StartsWith("game.", StringComparison.OrdinalIgnoreCase);
                        e.Handled = isGameShortcut || typed.Value is 'w' or 'W' or 'i' or 'I';
                    }
                    return;
                }
            };
            element.PreviewKeyDown += subscription.PreviewKeyDownHandler;
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

    private static bool IsTextInputFocused()
    {
        var focused = Keyboard.FocusedElement;
        if (focused is null)
        {
            return false;
        }

        if (focused is TextBox textBox)
        {
            return true;
        }

        if (focused is PasswordBox)
        {
            return true;
        }

        if (focused is RichTextBox richTextBox)
        {
            return true;
        }

        if (focused is ComboBox combo && combo.IsEditable)
        {
            return true;
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
