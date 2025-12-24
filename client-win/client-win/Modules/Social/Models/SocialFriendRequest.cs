using System;

namespace client_win.Modules.Social.Models;

public sealed class SocialFriendRequest
{
    public int Id { get; set; }
    public SocialUser Requester { get; set; } = new();
    public SocialUser Addressee { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
