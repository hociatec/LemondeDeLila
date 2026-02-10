using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using client_win.Modules.Error;
using client_win.Modules.Shell.Services;
using Serilog;

namespace client_win.Core.Diagnostics;

/// <summary>
/// Pare-chocs global: évite la fermeture WPF sur exception non gérée,
/// journalise, génère un crash report, publie sur ErrorBus et annonce au lecteur d'écran.
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
            HandleException(e.Exception, context: "unhandled.dispatcher", mayTerminate: false);
        }
        catch
        {
            // ignore
        }
        finally
        {
            e.Handled = true;
        }
    }

    private static void OnUnobservedTaskException(object? sender, UnobservedTaskExceptionEventArgs e)
    {
        try
        {
            // Unobserved task exceptions are typically "fire-and-forget" failures.
            // Avoid a modal error dialog: publish as Warning, but keep full details in logs/crash files.
            var aggregate = e.Exception;
            var root = aggregate is AggregateException agg
                ? (agg.Flatten().InnerExceptions.FirstOrDefault() ?? aggregate)
                : aggregate;
            HandleException(
                root,
                context: "unhandled.task",
                mayTerminate: false,
                severityOverride: ErrorSeverity.Warning,
                detailOverride: aggregate.ToString());
        }
        catch
        {
            // ignore
        }
        finally
        {
            e.SetObserved();
        }
    }

    private static void OnAppDomainUnhandledException(object? sender, UnhandledExceptionEventArgs e)
    {
        try
        {
            if (e.ExceptionObject is Exception ex)
            {
                HandleException(ex, context: "unhandled.appdomain", mayTerminate: e.IsTerminating);
            }
            else
            {
                HandleException(new Exception("Exception non gérée (objet non-Exception)"), context: "unhandled.appdomain", mayTerminate: e.IsTerminating);
            }
        }
        catch
        {
            // ignore
        }
    }

    private static void HandleException(
        Exception exception,
        string context,
        bool mayTerminate,
        ErrorSeverity? severityOverride = null,
        string? detailOverride = null)
    {
        var message = string.IsNullOrWhiteSpace(exception.Message)
            ? "Erreur inattendue"
            : exception.Message;

        var severity = severityOverride ?? ErrorSeverity.Error;
        var detail = detailOverride;

        var fullDetail = detail ?? exception.ToString();
        TryWriteCrashTextFiles(context, fullDetail);

        try
        {
            if (severity == ErrorSeverity.Warning)
            {
                Log.Warning(exception, "Exception non observée ({Context})", context);
            }
            else
            {
                Log.Fatal(exception, "Exception non gérée ({Context})", context);
            }
        }
        catch
        {
            // ignore
        }

        try
        {
            _crashReporter?.ReportCrash(exception, new AppError(
                message,
                severity,
                context: context,
                detail: detail ?? exception.ToString()));
        }
        catch
        {
            // ignore
        }

        try
        {
            _errors?.Publish(new AppError(
                message,
                severity,
                context: context,
                detail: mayTerminate ? "Le runtime a signalé une terminaison imminente." : detail));
        }
        catch
        {
            // ignore
        }

        try
        {
            var prefix = severity == ErrorSeverity.Warning ? "Avertissement" : "Erreur";
            if (severity == ErrorSeverity.Warning)
            {
                _announcer?.AnnouncePolite($"{prefix}: {message}");
            }
            else
            {
                _announcer?.AnnounceAssertive($"{prefix}: {message}");
            }
        }
        catch
        {
            // ignore
        }
    }

    private static void TryWriteCrashTextFiles(string context, string detail)
    {
        try
        {
            var timestamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
            var content =
                $"[{timestamp}] {context}{Environment.NewLine}{detail}{Environment.NewLine}{Environment.NewLine}";

            TryAppend(Path.Combine(Directory.GetCurrentDirectory(), "client", "log", "crash-latest.txt"), content);
            TryAppend(Path.Combine(AppContext.BaseDirectory, "client", "log", "crash-latest.txt"), content);
            TryAppend(
                Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "LeMondeDeLila",
                    "crash-latest.txt"),
                content);
        }
        catch
        {
            // ignore
        }
    }

    private static void TryAppend(string filePath, string content)
    {
        try
        {
            var dir = Path.GetDirectoryName(filePath);
            if (!string.IsNullOrWhiteSpace(dir))
            {
                Directory.CreateDirectory(dir);
            }

            File.AppendAllText(filePath, content);
        }
        catch
        {
            // ignore
        }
    }
}
