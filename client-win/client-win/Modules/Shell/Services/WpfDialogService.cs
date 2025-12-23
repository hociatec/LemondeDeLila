using System.Threading.Tasks;
using System.Windows;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Implémentation WPF simple des boîtes de dialogue. Thread-safe via Dispatcher.
/// </summary>
public sealed class WpfDialogService : IDialogService
{
    public Task ShowError(string title, string message) =>
        InvokeAsync(() => MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Error));

    public Task ShowInfo(string title, string message) =>
        InvokeAsync(() => MessageBox.Show(message, title, MessageBoxButton.OK, MessageBoxImage.Information));

    public Task<bool?> Confirm(string title, string message) =>
        InvokeAsync<bool?>(() =>
        {
            var result = MessageBox.Show(message, title, MessageBoxButton.YesNo, MessageBoxImage.Question);
            return result == MessageBoxResult.Yes;
        });

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
