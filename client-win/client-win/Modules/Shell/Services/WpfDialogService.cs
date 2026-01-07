using System.Threading.Tasks;
using System.Windows;
using System.Linq;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Implémentation WPF simple des boîtes de dialogue. Thread-safe via Dispatcher.
/// </summary>
public sealed class WpfDialogService : IDialogService
{
    public Task ShowError(string title, string message) =>
        InvokeAsync(() => ShowOwned(message, title, MessageBoxButton.OK, MessageBoxImage.Error));

    public Task ShowInfo(string title, string message) =>
        InvokeAsync(() => ShowOwned(message, title, MessageBoxButton.OK, MessageBoxImage.Information));

    public Task<bool?> Confirm(string title, string message, string? okText = null, string? cancelText = null) =>
        InvokeAsync<bool?>(() =>
        {
            if (string.IsNullOrWhiteSpace(okText) && string.IsNullOrWhiteSpace(cancelText))
            {
                var result = ShowOwned(message, title, MessageBoxButton.YesNo, MessageBoxImage.Question);
                return result == MessageBoxResult.Yes;
            }

            return ShowCustomConfirm(title, message, okText ?? "OK", cancelText ?? "Annuler");
        });

    public Task<DialogChoice?> Choose(string title, string message, string primaryText, string secondaryText, string cancelText) =>
        InvokeAsync<DialogChoice?>(() => ShowCustomChoice(title, message, primaryText, secondaryText, cancelText));

    private static bool? ShowCustomConfirm(string title, string message, string okText, string cancelText)
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
            Title = string.IsNullOrWhiteSpace(title) ? "Confirmation" : title,
            Owner = owner,
            WindowStartupLocation = owner != null ? WindowStartupLocation.CenterOwner : WindowStartupLocation.CenterScreen,
            SizeToContent = SizeToContent.WidthAndHeight,
            ResizeMode = ResizeMode.NoResize,
            ShowInTaskbar = false,
            Topmost = owner == null,
            MinWidth = 420,
            Background = Brushes.White,
        };

        bool? result = null;

        var root = new Grid
        {
            Margin = new Thickness(16),
        };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(12) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var text = new TextBox
        {
            Text = message ?? string.Empty,
            IsReadOnly = true,
            BorderThickness = new Thickness(0),
            Background = Brushes.Transparent,
            TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            MinWidth = 380,
            MaxWidth = 700,
            MinHeight = 90,
            MaxHeight = 420,
            Focusable = false,
        };
        Grid.SetRow(text, 0);
        root.Children.Add(text);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
        };
        Grid.SetRow(buttons, 2);

        var cancel = new Button
        {
            Content = cancelText,
            MinWidth = 120,
            Margin = new Thickness(0, 0, 8, 0),
            IsCancel = true,
        };
        cancel.Click += (_, _) =>
        {
            result = false;
            dialog.Close();
        };

        var ok = new Button
        {
            Content = okText,
            MinWidth = 140,
            IsDefault = true,
        };
        ok.Click += (_, _) =>
        {
            result = true;
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
                result = false;
                dialog.Close();
            }
        };

        dialog.ShowDialog();
        return result;
    }

    private static DialogChoice? ShowCustomChoice(string title, string message, string primaryText, string secondaryText, string cancelText)
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
            Title = string.IsNullOrWhiteSpace(title) ? "Choix" : title,
            Owner = owner,
            WindowStartupLocation = owner != null ? WindowStartupLocation.CenterOwner : WindowStartupLocation.CenterScreen,
            SizeToContent = SizeToContent.WidthAndHeight,
            ResizeMode = ResizeMode.NoResize,
            ShowInTaskbar = false,
            Topmost = owner == null,
            MinWidth = 520,
            Background = Brushes.White,
        };

        DialogChoice? result = null;

        var root = new Grid
        {
            Margin = new Thickness(16),
        };
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        root.RowDefinitions.Add(new RowDefinition { Height = new GridLength(12) });
        root.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });

        var text = new TextBox
        {
            Text = message ?? string.Empty,
            IsReadOnly = true,
            BorderThickness = new Thickness(0),
            Background = Brushes.Transparent,
            TextWrapping = TextWrapping.Wrap,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled,
            MinWidth = 420,
            MaxWidth = 800,
            MinHeight = 90,
            MaxHeight = 420,
            Focusable = false,
        };
        Grid.SetRow(text, 0);
        root.Children.Add(text);

        var buttons = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
        };
        Grid.SetRow(buttons, 2);

        var cancel = new Button
        {
            Content = cancelText,
            MinWidth = 120,
            Margin = new Thickness(0, 0, 8, 0),
            IsCancel = true,
        };
        cancel.Click += (_, _) =>
        {
            result = null;
            dialog.Close();
        };

        var secondary = new Button
        {
            Content = secondaryText,
            MinWidth = 140,
            Margin = new Thickness(0, 0, 8, 0),
        };
        secondary.Click += (_, _) =>
        {
            result = DialogChoice.Secondary;
            dialog.Close();
        };

        var primary = new Button
        {
            Content = primaryText,
            MinWidth = 160,
            IsDefault = true,
        };
        primary.Click += (_, _) =>
        {
            result = DialogChoice.Primary;
            dialog.Close();
        };

        buttons.Children.Add(cancel);
        buttons.Children.Add(secondary);
        buttons.Children.Add(primary);
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

        dialog.ShowDialog();
        return result;
    }

    private static MessageBoxResult ShowOwned(
        string message,
        string title,
        MessageBoxButton buttons,
        MessageBoxImage icon)
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

        return owner != null
            ? MessageBox.Show(owner, message, title, buttons, icon)
            : MessageBox.Show(message, title, buttons, icon);
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

    private static Task InvokeAsync(Action action)
    {
        if (Application.Current?.Dispatcher?.CheckAccess() == true)
        {
            action();
            return Task.CompletedTask;
        }
        return Application.Current?.Dispatcher?.InvokeAsync(action).Task ?? Task.CompletedTask;
    }

    private static Task<T?> InvokeAsync<T>(Func<T?> func)
    {
        if (Application.Current?.Dispatcher?.CheckAccess() == true)
        {
            return Task.FromResult(func());
        }
        return Application.Current?.Dispatcher?.InvokeAsync(func).Task ?? Task.FromResult<T?>(default);
    }
}
