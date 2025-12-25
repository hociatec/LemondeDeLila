using System.Text.Json.Serialization;

namespace client_win.Core.Diagnostics;

/// <summary>
/// Représente un rapport de crash détaillé sérialisable en JSON.
/// </summary>
public sealed class CrashReport
{
    /// <summary>
    /// Date et heure du crash (UTC).
    /// </summary>
    [JsonPropertyName("timestamp")]
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;

    /// <summary>
    /// Version de l'application.
    /// </summary>
    [JsonPropertyName("app_version")]
    public string AppVersion { get; init; } = string.Empty;

    /// <summary>
    /// Type de l'exception.
    /// </summary>
    [JsonPropertyName("exception_type")]
    public string ExceptionType { get; init; } = string.Empty;

    /// <summary>
    /// Message d'erreur.
    /// </summary>
    [JsonPropertyName("message")]
    public string Message { get; init; } = string.Empty;

    /// <summary>
    /// Stack trace complète.
    /// </summary>
    [JsonPropertyName("stack_trace")]
    public string? StackTrace { get; init; }

    /// <summary>
    /// Contexte de l'erreur (source, catégorie).
    /// </summary>
    [JsonPropertyName("context")]
    public string? Context { get; init; }

    /// <summary>
    /// Environnement système (OS, .NET runtime).
    /// </summary>
    [JsonPropertyName("environment")]
    public EnvironmentInfo Environment { get; init; } = new();

    /// <summary>
    /// Informations de session (sans données sensibles).
    /// </summary>
    [JsonPropertyName("session")]
    public SessionInfo? Session { get; init; }
}

/// <summary>
/// Informations sur l'environnement système.
/// </summary>
public sealed class EnvironmentInfo
{
    [JsonPropertyName("os_version")]
    public string OsVersion { get; init; } = System.Environment.OSVersion.ToString();

    [JsonPropertyName("clr_version")]
    public string ClrVersion { get; init; } = System.Environment.Version.ToString();

    [JsonPropertyName("machine_name")]
    public string MachineName { get; init; } = System.Environment.MachineName;

    [JsonPropertyName("user_domain")]
    public string UserDomain { get; init; } = System.Environment.UserDomainName;

    [JsonPropertyName("is_64bit_os")]
    public bool Is64BitOperatingSystem { get; init; } = System.Environment.Is64BitOperatingSystem;

    [JsonPropertyName("processors")]
    public int ProcessorCount { get; init; } = System.Environment.ProcessorCount;
}

/// <summary>
/// Informations de session (sans données sensibles comme username/password).
/// </summary>
public sealed class SessionInfo
{
    [JsonPropertyName("is_authenticated")]
    public bool IsAuthenticated { get; init; }

    [JsonPropertyName("session_duration_minutes")]
    public double? SessionDurationMinutes { get; init; }

    [JsonPropertyName("current_view")]
    public string? CurrentView { get; init; }
}
