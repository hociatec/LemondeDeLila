using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Threading;

namespace client_win.Modules.TextPrompts.Views;

public partial class ConfigPromptWindow : Window
{
    private string? _lastFocusedFieldKey;
    private bool _autoFocusDone;

    public Dictionary<string, string>? Result { get; private set; }

    public ConfigPromptWindow()
    {
        InitializeComponent();
        ContentRendered += OnContentRendered;
        PreviewKeyDown += OnPreviewKeyDown;
        Activated += OnActivated;
        PreviewGotKeyboardFocus += OnPreviewGotKeyboardFocus;
    }

    private void OnContentRendered(object? sender, EventArgs e)
    {
        // Focus fiable sur le premier champ (texte ou checkbox), sinon les lecteurs d'écran annoncent souvent "liste"
        // ou le nom interne des items avant l'élément utile.
        if (_autoFocusDone || !string.IsNullOrWhiteSpace(_lastFocusedFieldKey))
        {
            return;
        }

        Dispatcher.BeginInvoke(DispatcherPriority.ContextIdle, new Action(() =>
        {
            try
            {
                var first = FindFocusableInputs(this).FirstOrDefault();
                if (first == null)
                {
                    return;
                }

                first.Focus();
                Keyboard.Focus(first);
                if (first is TextBox tb)
                {
                    tb.SelectAll();
                }
                _autoFocusDone = true;
            }
            catch
            {
                // ignore
            }
        }));
    }

    private void OnPreviewKeyDown(object sender, KeyEventArgs e)
    {
        // ESC ne doit pas fermer ce dialogue (sinon on peut annuler la config involontairement).
        if (e.Key == Key.Escape)
        {
            e.Handled = true;
        }
    }

    private void OnActivated(object? sender, EventArgs e)
    {
        if (string.IsNullOrWhiteSpace(_lastFocusedFieldKey))
        {
            return;
        }

        var target = FindFocusableInputByAutomationId(_lastFocusedFieldKey);
        if (target == null)
        {
            return;
        }

        Dispatcher.BeginInvoke(DispatcherPriority.ContextIdle, new Action(() =>
        {
            try
            {
                target.Focus();
                Keyboard.Focus(target);
                if (target is TextBox tb)
                {
                    tb.SelectAll();
                }
            }
            catch
            {
                // ignore
            }
        }));
    }

    private void OnPreviewGotKeyboardFocus(object? sender, KeyboardFocusChangedEventArgs e)
    {
        if (e.NewFocus == null)
        {
            return;
        }

        var id = (AutomationProperties.GetAutomationId(e.NewFocus) ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(id))
        {
            return;
        }

        _lastFocusedFieldKey = id;
    }

    private void OnCancelClick(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
    }

    private void OnOkClick(object sender, RoutedEventArgs e)
    {
        try
        {
            if (DataContext is not ConfigPromptWindowModel vm)
            {
                DialogResult = false;
                return;
            }

            var dict = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var field in vm.Fields)
            {
                var key = (field.Key ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(key))
                {
                    continue;
                }

                if (field.IsBoolean)
                {
                    dict[key] = field.BoolValue ? "true" : "false";
                    continue;
                }

                dict[key] = (field.Text ?? string.Empty).Trim();
            }

            // Require all fields to be filled (simple generic rule).
            var missing = vm.Fields
                .Where(f => !string.IsNullOrWhiteSpace(f.Key))
                .Where(f => !f.IsBoolean)
                .Any(f => string.IsNullOrWhiteSpace(dict.GetValueOrDefault(f.Key, string.Empty)));
            if (missing)
            {
                MessageBox.Show(this, "Veuillez remplir tous les champs.", "Configuration",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            Result = dict;
            DialogResult = true;
        }
        catch
        {
            DialogResult = false;
        }
    }

    private Control? FindFocusableInputByAutomationId(string automationId)
    {
        if (string.IsNullOrWhiteSpace(automationId))
        {
            return null;
        }

        return FindFocusableInputs(this)
            .FirstOrDefault(c =>
                string.Equals(
                    (AutomationProperties.GetAutomationId(c) ?? string.Empty).Trim(),
                    automationId,
                    StringComparison.Ordinal));
    }

    private static IEnumerable<Control> FindFocusableInputs(DependencyObject root)
    {
        if (root == null)
        {
            yield break;
        }

        var count = VisualTreeHelper.GetChildrenCount(root);
        for (var i = 0; i < count; i++)
        {
            var child = VisualTreeHelper.GetChild(root, i);
            if (child is Control c &&
                c.IsVisible &&
                c.IsEnabled &&
                (c is TextBox || c is CheckBox) &&
                (c.Focusable || KeyboardNavigation.GetIsTabStop(c)))
            {
                yield return c;
            }

            foreach (var nested in FindFocusableInputs(child))
            {
                yield return nested;
            }
        }
    }
}
