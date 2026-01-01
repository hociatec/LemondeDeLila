using System.Text.Json.Serialization;

namespace client_win.Modules.Admin.Dtos;

public sealed class AdminProfileSettingsDto
{
    [JsonPropertyName("bioMinLength")]
    public int BioMinLength { get; set; }

    [JsonPropertyName("bioMaxLength")]
    public int BioMaxLength { get; set; }

    public override string ToString() => $"Bio {BioMinLength}-{BioMaxLength}";
}
