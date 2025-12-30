using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminBroadcastResponseDto
{
    [JsonPropertyName("delivered")]
    public int Delivered { get; set; }
}

public sealed class AdminClientUpdateAnnounceResponseDto
{
    [JsonPropertyName("delivered")]
    public int Delivered { get; set; }
}
