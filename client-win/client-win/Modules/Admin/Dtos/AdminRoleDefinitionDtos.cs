using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminRoleDefinitionDto
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("permissions")]
    public List<string> Permissions { get; set; } = new();
}

public sealed class AdminRoleDefinitionsResponseDto
{
    [JsonPropertyName("definitions")]
    public List<AdminRoleDefinitionDto> Definitions { get; set; } = new();
}
