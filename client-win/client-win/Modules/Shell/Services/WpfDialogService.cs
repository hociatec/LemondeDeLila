using System.Threading.Tasks;
using System.Windows;
using System.Linq;

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

    public Task<bool?> Confirm(string title, string message) =>
        InvokeAsync<bool?>(() =>
        {
            var result = ShowOwned(message, title, MessageBoxButton.YesNo, MessageBoxImage.Question);
            return result == MessageBoxResult.Yes;
        });

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
