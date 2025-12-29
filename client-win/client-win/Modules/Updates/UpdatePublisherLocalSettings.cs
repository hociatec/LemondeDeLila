using System;
using System.IO;
using System.Text.Json;
using client_win.Core.Constants;

namespace client_win.Modules.Updates;

public sealed record UpdatePublisherLocalSettings(
    string? ProjectPath,
    string? BaseUrl)
{
    private static string SettingsPath =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "config",
            "update-publisher.json");

    public static UpdatePublisherLocalSettings Load()
    {
        try
        {
            if (!File.Exists(SettingsPath))
            {
                return new UpdatePublisherLocalSettings(null, null);
            }
            var raw = File.ReadAllText(SettingsPath);
            var parsed = JsonSerializer.Deserialize<UpdatePublisherLocalSettings>(raw);
            return parsed ?? new UpdatePublisherLocalSettings(null, null);
        }
        catch
        {
            return new UpdatePublisherLocalSettings(null, null);
        }
    }

    public void Save()
    {
        var dir = Path.GetDirectoryName(SettingsPath);
        if (!string.IsNullOrWhiteSpace(dir))
        {
            Directory.CreateDirectory(dir);
        }
        var json = JsonSerializer.Serialize(this, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(SettingsPath, json);
    }
}

