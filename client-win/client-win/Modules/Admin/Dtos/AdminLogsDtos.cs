using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminLogsDownloadResponseDto
{
    [JsonPropertyName("file")]
    public string File { get; set; } = string.Empty;

    [JsonPropertyName("lines")]
    public List<string> Lines { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }
}
