namespace client_win.Modules.User.Models;

public sealed class LoginResult
{
    private LoginResult(bool success, string? username, string? token, int? userId, string? error)
    {
        Success = success;
        Username = username;
        Token = token;
        UserId = userId;
        ErrorMessage = error;
    }

    public bool Success { get; }

    public string? Username { get; }

    public string? Token { get; }

    public int? UserId { get; }

    public string? ErrorMessage { get; }

    public static LoginResult Ok(string username, string token, int userId) => new(true, username, token, userId, null);

    public static LoginResult Fail(string message) => new(false, null, null, null, message);
}
