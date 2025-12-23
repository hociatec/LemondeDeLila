namespace client_win.Modules.Error;

public enum ErrorSeverity
{
    Info,
    Warning,
    Error
}

public sealed class AppError
{
    public AppError(string message, ErrorSeverity severity = ErrorSeverity.Error, string? context = null, string? detail = null)
    {
        Message = message;
        Severity = severity;
        Context = context;
        Detail = detail;
    }

    public string Message { get; }
    public ErrorSeverity Severity { get; }
    public string? Context { get; }
    public string? Detail { get; }
}
