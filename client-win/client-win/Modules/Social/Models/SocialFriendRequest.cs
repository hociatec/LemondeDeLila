using System;

namespace client_win.Modules.Social.Models;

public sealed class SocialFriendRequest
{
    public int Id { get; set; }
    public SocialUser Requester { get; set; } = new();
    public SocialUser Addressee { get; set; } = new();
    public DateTime CreatedAt { get; set; }

    public override string ToString()
    {
        var requester = Requester?.Username ?? string.Empty;
        var addressee = Addressee?.Username ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(requester) && !string.IsNullOrWhiteSpace(addressee))
        {
            return $"{requester} -> {addressee}";
        }
        if (!string.IsNullOrWhiteSpace(requester))
        {
            return requester;
        }
        if (!string.IsNullOrWhiteSpace(addressee))
        {
            return addressee;
        }
        return base.ToString() ?? string.Empty;
    }
}
