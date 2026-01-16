using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public enum AdminBugReportStatus
{
    Pending,
    InProgress,
    ToTest,
    Refused,
    Done
}

public sealed class AdminBugReportDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("subject")]
    public string Subject { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string StatusRaw { get; set; } = "pending";

    [JsonIgnore]
    public AdminBugReportStatus Status => StatusRaw switch
    {
        "in_progress" => AdminBugReportStatus.InProgress,
        "to_test" => AdminBugReportStatus.ToTest,
        "refused" => AdminBugReportStatus.Refused,
        "rejected" => AdminBugReportStatus.Refused,
        "done" => AdminBugReportStatus.Done,
        _ => AdminBugReportStatus.Pending
    };

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = string.Empty;

    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = string.Empty;

    [JsonPropertyName("createdByUserId")]
    public int CreatedByUserId { get; set; }

    [JsonPropertyName("createdByUsername")]
    public string CreatedByUsername { get; set; } = string.Empty;

    [JsonPropertyName("commentsCount")]
    public int CommentsCount { get; set; }
}

public sealed class AdminBugReportsListResponseDto
{
    [JsonPropertyName("items")]
    public List<AdminBugReportDto>? Items { get; set; }
}

public sealed class AdminBugReportResponseDto
{
    [JsonPropertyName("report")]
    public AdminBugReportDto? Report { get; set; }
}

public sealed class AdminBugReportDeleteResponseDto
{
    [JsonPropertyName("removed")]
    public bool Removed { get; set; }
}
