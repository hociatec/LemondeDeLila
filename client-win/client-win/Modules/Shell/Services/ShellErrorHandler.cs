using System;
using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Error;
using client_win.Modules.Config;
using client_win.Core.Diagnostics;
using client_win.Core.Constants;
using client_win.Modules.Updates;
using Serilog;

namespace client_win.Modules.Shell.Services;

/// <summary>
/// Gère les erreurs globales (ErrorBus + exceptions non gérées) et affiche des dialogs sans boucles.
/// Génère également des rapports de crash pour les exceptions non gérées.
/// </summary>
public sealed class ShellErrorHandler : IDisposable
{
    private readonly ErrorBus _errors;
    private readonly INavigationService _navigation;
    private readonly IDialogService _dialogs;
    private readonly ClientConfiguration _config;
    private readonly Func<object> _homeContentProvider;
    private readonly CrashReporter? _crashReporter;
    private readonly IDisposable _subscription;
    private int _isShowingErrorDialog; // CORRECTION: Utilise int pour Interlocked (thread-safe)
    private string? _lastErrorMessage;
    private DateTime _lastErrorShownAt = DateTime.MinValue;
    private Exception? _lastUnhandledException;
    private bool _disposed;

    public ShellErrorHandler(
        ErrorBus errors,
        INavigationService navigation,
        IDialogService dialogs,
        ClientConfiguration config,
        Func<object> homeContentProvider,
        CrashReporter? crashReporter = null)
    {
        _errors = errors ?? throw new ArgumentNullException(nameof(errors));
        _navigation = navigation ?? throw new ArgumentNullException(nameof(navigation));
        _dialogs = dialogs ?? throw new ArgumentNullException(nameof(dialogs));
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _homeContentProvider = homeContentProvider ?? throw new ArgumentNullException(nameof(homeContentProvider));
        _crashReporter = crashReporter;

        _subscription = _errors.Subscribe(ShowErrorDialog);
        RegisterUnhandledExceptions();

        Log.Information("ShellErrorHandler initialisé avec CrashReporter: {HasCrashReporter}", _crashReporter != null);
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

        var appError = new AppError(
            e.Exception.Message,
            ErrorSeverity.Error,
            context: "unhandled.dispatcher",
            detail: e.Exception.StackTrace);

        // Générer rapport de crash
        _crashReporter?.ReportCrash(e.Exception, appError);

        _errors.Publish(appError);
        e.Handled = true;
        EnsureHomeVisible();

        Log.Fatal(e.Exception, "Exception non gérée dans Dispatcher");
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

        var appError = new AppError(
            ex.Message,
            ErrorSeverity.Error,
            context: "unhandled.appdomain",
            detail: ex.StackTrace);

        // Générer rapport de crash
        _crashReporter?.ReportCrash(ex, appError);

        _errors.Publish(appError);
        EnsureHomeVisible();

        Log.Fatal(ex, "Exception non gérée dans AppDomain (terminaison: {IsTerminating})", e.IsTerminating);
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
                if (IsUpdateRequiredError(err))
                {
                    await ShowUpdateRequiredDialogAsync(err).ConfigureAwait(false);
                    return;
                }

                // Anti-flood: ignore les messages identiques dans un délai configuré
                if (string.Equals(_lastErrorMessage, message, StringComparison.Ordinal) &&
                    now - _lastErrorShownAt < TimeSpan.FromSeconds(AppConstants.ErrorDialogAntiFloodSeconds))
                {
                    Log.Debug("Message d'erreur en double ignoré (anti-flood)");
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

    private static bool IsUpdateRequiredError(AppError err)
    {
        var msg = (err.Message ?? string.Empty).Trim();
        if (msg.Length == 0) return false;
        return msg.StartsWith("Mise à jour requise", StringComparison.OrdinalIgnoreCase) ||
               msg.Contains("version minimale", StringComparison.OrdinalIgnoreCase) ||
               msg.Contains("update required", StringComparison.OrdinalIgnoreCase);
    }

    private async Task ShowUpdateRequiredDialogAsync(AppError err)
    {
        await Updates.ClientUpdateManager
            .HandleRequiredFromErrorAsync(_config, _dialogs, err.Message)
            .ConfigureAwait(false);
    }

    private static void TryOpenUrl(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
        catch
        {
            // ignore
        }
    }

    private void EnsureHomeVisible()
    {
        if (_navigation.CurrentContent == null)
        {
            var home = _homeContentProvider();
            if (home != null)
            {
                _navigation.Show(home);
            }
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
