namespace client_win.Modules.User.Models;

public sealed class RegistrationResult
{
    private RegistrationResult(bool success, string? username, string? error)
    {
        Success = success;
        Username = username;
        ErrorMessage = error;
    }

    public bool Success { get; }

    public string? Username { get; }

    public string? ErrorMessage { get; }

    public static RegistrationResult Ok(string username) => new(true, username, null);

    public static RegistrationResult Fail(string message) => new(false, null, message);
}
