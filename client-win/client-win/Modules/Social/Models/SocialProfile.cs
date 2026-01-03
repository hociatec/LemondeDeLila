using System;

namespace client_win.Modules.Social.Models;

public sealed class SocialProfile
{
    public SocialUser User { get; set; } = new();
    public string Bio { get; set; } = string.Empty;
    public string Visibility { get; set; } = "public";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsOwner { get; set; }
    public bool CanView { get; set; }
}
