using System;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Modules.Error;
using client_win.Modules.Shell.Services;
using Serilog;

namespace client_win.Core.Diagnostics;

/// <summary>
/// Pare-chocs global: empêche l'application de se fermer sur exception non gérée,
/// journalise, génère un rapport, et publie sur ErrorBus + annonce NVDA.
/// </summary>
public static class GlobalExceptionShield
{
    private static int _initialized;
    private static ErrorBus? _errors;
    private static CrashReporter? _crashReporter;
    private static IScreenReaderAnnouncer? _announcer;

    public static void Initialize(
        ErrorBus errors,
        CrashReporter crashReporter,
        IScreenReaderAnnouncer announcer)
    {
        if (errors == null) throw new ArgumentNullException(nameof(errors));
        if (crashReporter == null) throw new ArgumentNullException(nameof(crashReporter));
        if (announcer == null) throw new ArgumentNullException(nameof(announcer));

        if (System.Threading.Interlocked.Exchange(ref _initialized, 1) == 1)
        {
            return;
        }

        _errors = errors;
        _crashReporter = crashReporter;
        _announcer = announcer;

        if (Application.Current != null)
        {
            Application.Current.DispatcherUnhandledException += OnDispatcherUnhandledException;
        }

        AppDomain.CurrentDomain.UnhandledException += OnAppDomainUnhandledException;
        TaskScheduler.UnobservedTaskException += OnUnobservedTaskException;

        Log.Information("GlobalExceptionShield initialisé");
    }

    private static void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        try
        {
            HandleException(
                e.Exception,
                context: "unhandled.dispatcher",
                mayTerminate: false);
        }
        catch
        {
            // ne rien relancer
        }
        finally
        {
            // IMPORTANT: empêche la fermeture WPF
            e.Handled = true;
        }
    }

    private static void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        try
        {
            HandleException(
                e.Exception,
                context: "unhandled.task",
                mayTerminate: false);
        }
        catch
        {
            // ne rien relancer
        }
        finally
        {
            // IMPORTANT: empêche le process de terminer à cause d'une Task non observée
            e.SetObserved();
        }
    }

    private static void OnAppDomainUnhandledException(object? sender, UnhandledExceptionEventArgs e)
    {
        try
        {
            if (e.ExceptionObject is Exception ex)
            {
                HandleException(
                    ex,
                    context: "unhandled.appdomain",
                    mayTerminate: e.IsTerminating);
            }
            else
            {
                HandleException(
                    new Exception("Exception non gérée (objet non Exception)"),
                    context: "unhandled.appdomain",
                    mayTerminate: e.IsTerminating);
            }
        }
        catch
        {
            // ne rien relancer
        }
    }

    private static void HandleException(Exception exception, string context, bool mayTerminate)
    {
        if (exception == null) return;

        var message = string.IsNullOrWhiteSpace(exception.Message)
            ? "Erreur inattendue"
            : exception.Message;

        try
        {
            Log.Fatal(exception, "Exception non gérée ({Context})", context);
        }
        catch
        {
            // ignore
        }

        try
        {
            _crashReporter?.ReportCrash(exception, new AppError(
                message,
                ErrorSeverity.Error,
                context: context,
                detail: exception.ToString()));
        }
        catch
        {
            // ignore
        }

        try
        {
            _errors?.Publish(new AppError(
                message,
                ErrorSeverity.Error,
                context: context,
                detail: mayTerminate ? "Le runtime a signalé une terminaison imminente." : null));
        }
        catch
        {
            // ignore
        }

        try
        {
            _announcer?.AnnounceAssertive($"Erreur: {message}");
        }
        catch
        {
            // ignore
        }
    }
}

