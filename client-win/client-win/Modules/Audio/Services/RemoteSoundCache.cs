using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Audio.Models;
using client_win.Modules.Config;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Audio.Services;

public sealed class RemoteSoundCache : IRemoteSoundCache
{
    private readonly ClientConfiguration _config;
    private readonly ILogger<RemoteSoundCache> _logger;
    private readonly object _gate = new();
    private readonly Dictionary<SoundId, string> _pathsBySound = new();
    private DateTime _lastRefreshUtc = DateTime.MinValue;

    public RemoteSoundCache(ClientConfiguration config, ILogger<RemoteSoundCache> logger)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public string? TryGetPath(SoundId sound)
    {
        lock (_gate)
        {
            return _pathsBySound.TryGetValue(sound, out var path) ? path : null;
        }
    }

    public async Task RefreshAsync(CancellationToken cancellationToken = default)
    {
        if (DateTime.UtcNow - _lastRefreshUtc < TimeSpan.FromMinutes(2))
        {
            return;
        }
        _lastRefreshUtc = DateTime.UtcNow;

        try
        {
            using var http = new HttpClient();
            var endpoint = new Uri(_config.HttpBase, "sounds/manifest");
            var json = await http.GetStringAsync(endpoint, cancellationToken).ConfigureAwait(false);
            var manifest = JsonSerializer.Deserialize<RemoteSoundManifestDto>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (manifest?.Sounds == null || manifest.Sounds.Count == 0)
            {
                return;
            }

            foreach (var (idString, entry) in manifest.Sounds)
            {
                if (!Enum.TryParse<SoundId>(idString, ignoreCase: true, out var soundId))
                {
                    continue;
                }
                if (string.IsNullOrWhiteSpace(entry?.Sha256) || string.IsNullOrWhiteSpace(entry?.Url))
                {
                    continue;
                }

                var cached = await EnsureCachedAsync(soundId, entry, cancellationToken).ConfigureAwait(false);
                if (cached != null)
                {
                    lock (_gate)
                    {
                        _pathsBySound[soundId] = cached;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sounds refresh failed");
        }
    }

    private async Task<string?> EnsureCachedAsync(SoundId soundId, RemoteSoundManifestEntryDto entry, CancellationToken cancellationToken)
    {
        var sha256 = entry.Sha256;
        var url = entry.Url;
        if (string.IsNullOrWhiteSpace(sha256) || string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var cacheDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "sounds-cache");
        Directory.CreateDirectory(cacheDir);

        var fileName = $"{soundId}-{sha256}.mp3";
        var destPath = Path.Combine(cacheDir, fileName);
        if (File.Exists(destPath))
        {
            return destPath;
        }

        var tmpPath = destPath + ".tmp";
        try
        {
            using var http = new HttpClient();
            Uri uri;
            if (Uri.TryCreate(url, UriKind.Absolute, out var abs) && abs != null)
            {
                uri = abs;
            }
            else
            {
                uri = new Uri(_config.HttpBase, ".." + url.Trim());
            }

            await using var response = await http.GetStreamAsync(uri, cancellationToken).ConfigureAwait(false);
            await using (var fs = File.Create(tmpPath))
            {
                await response.CopyToAsync(fs, cancellationToken).ConfigureAwait(false);
            }
            File.Move(tmpPath, destPath, overwrite: true);
            return destPath;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sound download failed ({Sound})", soundId);
            try { if (File.Exists(tmpPath)) File.Delete(tmpPath); } catch { /* ignore */ }
            return null;
        }
    }

    private sealed class RemoteSoundManifestDto
    {
        public Dictionary<string, RemoteSoundManifestEntryDto>? Sounds { get; set; }
    }

    private sealed class RemoteSoundManifestEntryDto
    {
        public string? Sha256 { get; set; }
        public string? Url { get; set; }
    }
}
