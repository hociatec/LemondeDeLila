using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using client_win.Core.Input;
using client_win.Modules.Shell.Services;

namespace client_win.Modules.Game.Shell.Views;

public sealed class GameActionMenuWindow : Window
{
    private readonly ListBox _list;

    private GameActionMenuWindow(string title, IReadOnlyList<ShortcutDefinition> shortcuts)
    {
        Title = string.IsNullOrWhiteSpace(title) ? "Menu de la table" : title.Trim();
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        SizeToContent = SizeToContent.WidthAndHeight;
        ResizeMode = ResizeMode.NoResize;
        ShowInTaskbar = false;
        MinWidth = 520;
        Background = Brushes.White;

        var root = new Grid { Margin = new Thickness(16) };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(12) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(12) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        root.Children.Add(new TextBlock
        {
            Text = "Choisissez une action (Entrée). F2 : fermer.",
            TextWrapping = TextWrapping.Wrap,
        });

        _list = new ListBox
        {
            MinWidth = 480,
            MaxWidth = 900,
            MinHeight = 240,
            MaxHeight = 520,
        };
        Grid.SetRow(_list, 2);
        root.Children.Add(_list);

        foreach (var shortcut in shortcuts)
        {
            var canExecute = shortcut.Command.CanExecute(shortcut.CommandParameter);
            _list.Items.Add(new ListBoxItem
            {
                Content = BuildLabel(shortcut),
                Tag = shortcut,
                IsEnabled = canExecute,
            });
        }

        var close = new Button
        {
            Content = "Fermer",
            MinWidth = 120,
            HorizontalAlignment = HorizontalAlignment.Right,
        };
        Grid.SetRow(close, 4);
        close.Click += (_, _) => Close();
        root.Children.Add(close);

        Content = root;

        Loaded += (_, _) =>
        {
            if (_list.Items.Count > 0)
            {
                _list.SelectedIndex = 0;
            }
            _list.Focus();
        };

        _list.MouseDoubleClick += (_, _) => ExecuteSelected();
        _list.KeyDown += (_, e) =>
        {
            if (e.Key == Key.Enter || e.Key == Key.Return)
            {
                e.Handled = true;
                ExecuteSelected();
            }
        };

        PreviewKeyDown += (_, e) =>
        {
            if (e.Key is Key.F2 or Key.Escape)
            {
                Close();
            }
        };
    }

    public static bool ShowAndExecute(Window? owner, string title, IReadOnlyList<ShortcutDefinition> shortcuts)
    {
        var filtered = (shortcuts ?? Array.Empty<ShortcutDefinition>())
            .Where(s => s != null)
            .OrderBy(s => SortKey(s.Code))
            .ThenBy(s => (s.Description ?? s.Code ?? string.Empty).Trim(), StringComparer.CurrentCultureIgnoreCase)
            .ToList();

        if (filtered.Count == 0)
        {
            return false;
        }

        var w = new GameActionMenuWindow(title, filtered) { Owner = owner };
        FocusParking.Park(owner);
        NvdaDialogFocus.Configure(w, owner);
        w.ShowDialog();
        return true;
    }

    private void ExecuteSelected()
    {
        if (_list.SelectedItem is not ListBoxItem item)
        {
            return;
        }

        if (!item.IsEnabled)
        {
            return;
        }

        if (item.Tag is not ShortcutDefinition shortcut)
        {
            return;
        }

        try
        {
            if (shortcut.Command.CanExecute(shortcut.CommandParameter))
            {
                shortcut.Command.Execute(shortcut.CommandParameter);
            }
        }
        catch
        {
            // ignore (best-effort)
        }
        finally
        {
            Close();
        }
    }

    private static int SortKey(string? code)
    {
        var c = (code ?? string.Empty).Trim().ToLowerInvariant();
        if (c.StartsWith("ui.")) return 0;
        if (c.StartsWith("game.")) return 1;
        if (c.StartsWith("room.")) return 2;
        return 3;
    }

    private static string BuildLabel(ShortcutDefinition shortcut)
    {
        var description = (shortcut.Description ?? shortcut.Code ?? "Action").Trim();
        var key = FormatKey(shortcut);
        return string.IsNullOrWhiteSpace(key) ? description : $"{key} - {description}";
    }

    private static string FormatKey(ShortcutDefinition shortcut)
    {
        try
        {
            if (shortcut.Gesture != null)
            {
                return shortcut.Gesture.GetDisplayStringForCulture(CultureInfo.CurrentCulture);
            }
        }
        catch
        {
            // ignore
        }

        if (shortcut.Key is { } ch)
        {
            return ch.ToString().ToUpperInvariant();
        }

        return string.Empty;
    }
}
