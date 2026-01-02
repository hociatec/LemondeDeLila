using System;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.TextPrompts.Services;

public sealed class SecretPromptService : ISecretPromptService
{
    public Task<string?> PromptSecretAsync(string title, string label)
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var owner = GetOwnerWindow();
            try
            {
                owner?.Activate();
            }
            catch
            {
                // ignore
            }

            var dialog = new Window
            {
                Title = string.IsNullOrWhiteSpace(title) ? "Saisie" : title.Trim(),
                Owner = owner,
                WindowStartupLocation = owner != null ? WindowStartupLocation.CenterOwner : WindowStartupLocation.CenterScreen,
                SizeToContent = SizeToContent.WidthAndHeight,
                ResizeMode = ResizeMode.NoResize,
                ShowInTaskbar = false,
                Topmost = owner == null,
                MinWidth = 520,
                Background = Brushes.White,
            };

            string? result = null;

            var root = new Grid
            {
                Margin = new Thickness(16),
            };
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(8) });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(16) });
            root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

            var labelBlock = new TextBlock
            {
                Text = string.IsNullOrWhiteSpace(label) ? "Valeur" : label.Trim(),
                TextWrapping = TextWrapping.Wrap,
            };
            Grid.SetRow(labelBlock, 0);
            root.Children.Add(labelBlock);

            var input = new PasswordBox
            {
                MinWidth = 460,
            };
            Grid.SetRow(input, 2);
            root.Children.Add(input);

            var buttons = new StackPanel
            {
                Orientation = Orientation.Horizontal,
                HorizontalAlignment = HorizontalAlignment.Right,
            };
            Grid.SetRow(buttons, 4);

            var cancel = new Button
            {
                Content = "Annuler",
                MinWidth = 120,
                Margin = new Thickness(0, 0, 8, 0),
                IsCancel = true,
            };
            cancel.Click += (_, _) =>
            {
                result = null;
                dialog.Close();
            };

            var ok = new Button
            {
                Content = "OK",
                MinWidth = 140,
                IsDefault = true,
            };
            ok.Click += (_, _) =>
            {
                var value = (input.Password ?? string.Empty).Trim();
                result = string.IsNullOrWhiteSpace(value) ? null : value;
                dialog.Close();
            };

            buttons.Children.Add(cancel);
            buttons.Children.Add(ok);
            root.Children.Add(buttons);

            dialog.Content = root;
            dialog.PreviewKeyDown += (_, e) =>
            {
                if (e.Key == Key.Escape)
                {
                    result = null;
                    dialog.Close();
                }
            };

            dialog.Loaded += (_, _) =>
            {
                input.Focus();
                input.SelectAll();
            };

            dialog.ShowDialog();
            return result;
        }).Task;
    }

    private static Window? GetOwnerWindow()
    {
        var app = Application.Current;
        if (app == null)
        {
            return null;
        }

        var windows = app.Windows.OfType<Window>().ToArray();
        if (windows.Length == 0)
        {
            return app.MainWindow;
        }

        var active = windows.FirstOrDefault(w => w.IsActive);
        if (active != null)
        {
            return active;
        }

        if (app.MainWindow != null)
        {
            return app.MainWindow;
        }

        var visible = windows.FirstOrDefault(w => w.IsVisible);
        return visible ?? windows[0];
    }
}

