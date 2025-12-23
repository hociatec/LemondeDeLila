namespace client_win.Modules.User.Models;

public sealed class AuthenticatedUser
{
    public AuthenticatedUser(string username, string token, int userId)
    {
        Username = username;
        Token = token;
        UserId = userId;
    }

    public string Username { get; }

    public string Token { get; }

    public int UserId { get; }
}
