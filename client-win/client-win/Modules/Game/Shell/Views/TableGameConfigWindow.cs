using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;

namespace client_win.Modules.Game.Shell.Views;

public static class TableGameConfigWindow
{
    public sealed record Field(string Key, string Label, string Kind, int? Min, int? Max, string InitialText);

    public sealed record Prompt(string Title, string ActionType, string? CancelActionType, IReadOnlyList<Field> Fields);

    public static Dictionary<string, object>? Pick(Window? owner, Prompt prompt)
    {
        if (prompt == null || prompt.Fields == null || prompt.Fields.Count == 0)
        {
            return null;
        }

        var vm = prompt.Fields
            .Select(f => new FieldVm(
                key: (f.Key ?? string.Empty).Trim(),
                label: string.IsNullOrWhiteSpace(f.Label) ? (f.Key ?? string.Empty).Trim() : f.Label.Trim(),
                kind: (f.Kind ?? "text").Trim(),
                min: f.Min,
                max: f.Max,
                initialText: f.InitialText ?? string.Empty))
            .Where(f => !string.IsNullOrWhiteSpace(f.Key))
            .ToList();

        if (vm.Count == 0)
        {
            return null;
        }

        var safeOwner = owner ?? Application.Current?.MainWindow;
        var window = new Window
        {
            Title = string.IsNullOrWhiteSpace(prompt.Title) ? "Configuration du jeu" : prompt.Title.Trim(),
            Owner = safeOwner,
            WindowStartupLocation = safeOwner != null ? WindowStartupLocation.CenterOwner : WindowStartupLocation.CenterScreen,
            SizeToContent = SizeToContent.WidthAndHeight,
            MinWidth = 600,
            MinHeight = 360,
            ResizeMode = ResizeMode.NoResize,
            Background = System.Windows.Media.Brushes.White
        };

        var root = new Grid { Margin = new Thickness(16) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var title = new TextBlock
        {
            Text = window.Title,
            FontSize = 18,
            FontWeight = FontWeights.SemiBold,
            Margin = new Thickness(0, 0, 0, 10)
        };
        Grid.SetRow(title, 0);
        root.Children.Add(title);

        var scroll = new ScrollViewer
        {
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            MaxHeight = 460
        };
        Grid.SetRow(scroll, 1);
        root.Children.Add(scroll);

        var fieldsPanel = new StackPanel();
        scroll.Content = fieldsPanel;

        Control? firstInput = null;
        foreach (var f in vm)
        {
            var stack = new StackPanel { Margin = new Thickness(0, 6, 0, 6) };
            fieldsPanel.Children.Add(stack);

            if (f.IsBool)
            {
                var cb = new CheckBox
                {
                    Content = f.Label,
                    IsChecked = f.BoolValue
                };
                cb.Checked += (_, _) => f.BoolValue = true;
                cb.Unchecked += (_, _) => f.BoolValue = false;
                stack.Children.Add(cb);
                firstInput ??= cb;
            }
            else
            {
                stack.Children.Add(new TextBlock
                {
                    Text = f.Label,
                    Margin = new Thickness(0, 0, 0, 4)
                });
                var box = new TextBox
                {
                    Text = f.Text,
                    MinWidth = 520
                };
                box.TextChanged += (_, _) => f.Text = box.Text ?? string.Empty;
                stack.Children.Add(box);
                firstInput ??= box;
            }
        }

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 12, 0, 0)
        };
        Grid.SetRow(buttons, 2);
        root.Children.Add(buttons);

        var cancel = new Button
        {
            Content = "Annuler",
            Width = 120,
            Margin = new Thickness(0, 0, 8, 0),
            IsCancel = true
        };
        cancel.Click += (_, _) =>
        {
            window.DialogResult = false;
            window.Close();
        };
        buttons.Children.Add(cancel);

        var start = new Button
        {
            Content = "Demarrer",
            Width = 120,
            IsDefault = true
        };
        start.Click += (_, _) =>
        {
            var payload = BuildPayloadOrShowError(window, vm);
            if (payload == null)
            {
                return;
            }
            window.Tag = payload;
            window.DialogResult = true;
            window.Close();
        };
        buttons.Children.Add(start);

        window.Content = root;
        window.Loaded += (_, _) =>
        {
            if (firstInput != null)
            {
                firstInput.Focus();
            }
        };

        var ok = window.ShowDialog();
        return ok == true ? window.Tag as Dictionary<string, object> : null;
    }

    private static Dictionary<string, object>? BuildPayloadOrShowError(Window owner, IReadOnlyList<FieldVm> fields)
    {
        var payload = new Dictionary<string, object>(StringComparer.Ordinal);
        foreach (var field in fields)
        {
            if (field.IsBool)
            {
                payload[field.Key] = field.BoolValue;
                continue;
            }

            var text = (field.Text ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                MessageBox.Show(owner, $"Veuillez remplir le champ: {field.Label}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }

            var isNumber = string.Equals(field.Kind, "number", StringComparison.OrdinalIgnoreCase);
            if (!isNumber)
            {
                payload[field.Key] = text;
                continue;
            }

            if (!int.TryParse(text, out var value))
            {
                MessageBox.Show(owner, $"Veuillez entrer un nombre pour: {field.Label}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }
            if (field.Min.HasValue && value < field.Min.Value)
            {
                MessageBox.Show(owner, $"Valeur minimale pour {field.Label}: {field.Min.Value}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }
            if (field.Max.HasValue && value > field.Max.Value)
            {
                MessageBox.Show(owner, $"Valeur maximale pour {field.Label}: {field.Max.Value}.", "Configuration", MessageBoxButton.OK, MessageBoxImage.Warning);
                return null;
            }

            payload[field.Key] = value;
        }

        return payload;
    }

    private sealed class FieldVm
    {
        public FieldVm(string key, string label, string kind, int? min, int? max, string initialText)
        {
            Key = key;
            Label = label;
            Kind = kind;
            Min = min;
            Max = max;
            Text = initialText;
            BoolValue = ParseBool(initialText);
        }

        public string Key { get; }
        public string Label { get; }
        public string Kind { get; }
        public int? Min { get; }
        public int? Max { get; }
        public string Text { get; set; }
        public bool BoolValue { get; set; }

        public bool IsBool =>
            string.Equals(Kind, "bool", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(Kind, "boolean", StringComparison.OrdinalIgnoreCase);

        private static bool ParseBool(string? text)
        {
            var v = (text ?? string.Empty).Trim().ToLowerInvariant();
            return v is "true" or "1" or "oui" or "yes" or "on";
        }
    }
}
