using System;

namespace client_win.Modules.Social.Models;

public sealed class SocialUser
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? Avatar { get; set; }
    public DateTime? Since { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? BlockedAt { get; set; }

    public override string ToString()
    {
        return Username;
    }
}
