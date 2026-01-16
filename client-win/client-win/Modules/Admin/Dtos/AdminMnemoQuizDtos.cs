using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminMnemoQuizCategoryDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
}

public sealed class AdminMnemoQuizCategoriesResponseDto
{
    [JsonPropertyName("categories")]
    public List<AdminMnemoQuizCategoryDto> Categories { get; set; } = new();
}

public sealed class AdminMnemoQuizQuestionDto
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("categoryId")]
    public string CategoryId { get; set; } = string.Empty;

    [JsonPropertyName("question")]
    public string Question { get; set; } = string.Empty;

    [JsonPropertyName("status")]
    public string Status { get; set; } = "pending";

    [JsonPropertyName("createdAt")]
    public string CreatedAt { get; set; } = string.Empty;

    [JsonPropertyName("updatedAt")]
    public string UpdatedAt { get; set; } = string.Empty;

    [JsonPropertyName("answers")]
    public List<string> Answers { get; set; } = new();

    [JsonPropertyName("correctIndex")]
    public int CorrectIndex { get; set; }
}

public sealed class AdminMnemoQuizQuestionsResponseDto
{
    [JsonPropertyName("questions")]
    public List<AdminMnemoQuizQuestionDto> Questions { get; set; } = new();
}

