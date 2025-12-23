using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Error;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Gère les erreurs globales (ErrorBus + exceptions non gérées) et affiche des dialogs sans boucles.
/// </summary>
public sealed class ShellErrorHandler : IDisposable
{
    private readonly ErrorBus _errors;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly Func<System.Windows.Controls.UserControl> _homeViewProvider;
    private readonly IDisposable _subscription;
    private int _isShowingErrorDialog; // CORRECTION: Utilise int pour Interlocked (thread-safe)
    private string? _lastErrorMessage;
    private DateTime _lastErrorShownAt = DateTime.MinValue;
    private Exception? _lastUnhandledException;
    private bool _disposed;

    public ShellErrorHandler(ErrorBus errors, INavigationService navigation, IDialogService dialogs, Func<System.Windows.Controls.UserControl> homeViewProvider)
    {
        _errors = errors ?? throw new ArgumentNullException(nameof(errors));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _homeViewProvider = homeViewProvider ?? throw new ArgumentNullException(nameof(homeViewProvider));

        _subscription = _errors.Subscribe(ShowErrorDialog);
        RegisterUnhandledExceptions();
    }

    private void RegisterUnhandledExceptions()
    {
        if (Application.Current != null)
        {
            Application.Current.DispatcherUnhandledException += OnDispatcherUnhandledException;
        }
        AppDomain.CurrentDomain.UnhandledException += OnAppDomainUnhandledException;
    }

    private void OnDispatcherUnhandledException(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e)
    {
        if (ReferenceEquals(_lastUnhandledException, e.Exception))
        {
            e.Handled = true;
            return;
        }

        _lastUnhandledException = e.Exception;
        _errors.Publish(new AppError(e.Exception.Message, ErrorSeverity.Error, context: "unhandled.dispatcher", detail: e.Exception.StackTrace));
        e.Handled = true;
        EnsureHomeVisible();
    }

    private void OnAppDomainUnhandledException(object? sender, UnhandledExceptionEventArgs e)
    {
        if (e.ExceptionObject is not Exception ex)
        {
            return;
        }

        if (ReferenceEquals(_lastUnhandledException, ex))
        {
            return;
        }

        _lastUnhandledException = ex;
        _errors.Publish(new AppError(ex.Message, ErrorSeverity.Error, context: "unhandled.appdomain", detail: ex.StackTrace));
        EnsureHomeVisible();
    }

    private void ShowErrorDialog(AppError err)
    {
        if (err.Severity != ErrorSeverity.Error)
        {
            return;
        }

        Task.Run(async () =>
        {
            var detail = string.IsNullOrWhiteSpace(err.Detail) ? string.Empty : $"\nDétail: {err.Detail}";
            var message = $"{err.Message}{detail}";
            var now = DateTime.UtcNow;

            // CORRECTION: Utilise Interlocked.CompareExchange pour éviter race condition
            // Si la valeur actuelle est 1 (dialog en cours), on retourne immédiatement
            if (System.Threading.Interlocked.CompareExchange(ref _isShowingErrorDialog, 1, 0) == 1)
            {
                return;
            }

            try
            {
                // Anti-flood: ignore les messages identiques dans un délai de 5 secondes
                if (string.Equals(_lastErrorMessage, message, StringComparison.Ordinal) &&
                    now - _lastErrorShownAt < TimeSpan.FromSeconds(5))
                {
                    return;
                }

                _lastErrorMessage = message;
                _lastErrorShownAt = now;
                await _dialogs.ShowError("Erreur", message).ConfigureAwait(false);
                EnsureHomeVisible();
            }
            finally
            {
                // CORRECTION: Utilise Interlocked.Exchange pour garantir la visibilité de la modification
                System.Threading.Interlocked.Exchange(ref _isShowingErrorDialog, 0);
            }
        });
    }

    private void EnsureHomeVisible()
    {
        if (_navigation.CurrentView == null)
        {
            var home = _homeViewProvider();
            _navigation.Show(home);
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _subscription.Dispose();
        if (Application.Current != null)
        {
            Application.Current.DispatcherUnhandledException -= OnDispatcherUnhandledException;
        }
        AppDomain.CurrentDomain.UnhandledException -= OnAppDomainUnhandledException;
    }
}
