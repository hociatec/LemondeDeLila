using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminBugReportCommentDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("reportId")]
    public string ReportId { get; set; } = string.Empty;

    [JsonPropertyName("content")]
    public string Content { get; set; } = string.Empty;

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = string.Empty;

    [JsonPropertyName("createdByUserId")]
    public int CreatedByUserId { get; set; }

    [JsonPropertyName("createdByUsername")]
    public string CreatedByUsername { get; set; } = string.Empty;
}

public sealed class AdminBugReportCommentsListResponseDto
{
    [JsonPropertyName("items")]
    public List<AdminBugReportCommentDto>? Items { get; set; }
}

public sealed class AdminBugReportCommentResponseDto
{
    [JsonPropertyName("comment")]
    public AdminBugReportCommentDto? Comment { get; set; }

    [JsonPropertyName("reportId")]
    public string ReportId { get; set; } = string.Empty;

    [JsonPropertyName("commentsCount")]
    public int CommentsCount { get; set; }
}
