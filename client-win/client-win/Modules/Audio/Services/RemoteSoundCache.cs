using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Core.Network;
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
        TryLoadFromDisk();
        TryFillMissingFromCacheDir();
    }

    public string? TryGetPath(SoundId sound)
    {
        lock (_gate)
        {
            return _pathsBySound.TryGetValue(sound, out var path) ? path : null;
        }
    }

    public async Task RefreshAsync(bool force = false, CancellationToken cancellationToken = default)
    {
        if (!force && DateTime.UtcNow - _lastRefreshUtc < TimeSpan.FromMinutes(2))
        {
            return;
        }

        try
        {
            var endpoint = new Uri(_config.HttpBase, "sounds/manifest");
            using var req = new HttpRequestMessage(HttpMethod.Get, endpoint);
            using var res = await HttpClientProvider.Shared
                .SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
            res.EnsureSuccessStatusCode();
            var json = await res.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            var manifest = JsonSerializer.Deserialize<RemoteSoundManifestDto>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (manifest?.Sounds == null || manifest.Sounds.Count == 0)
            {
                return;
            }

            TrySaveManifest(json);

            var refreshed = new Dictionary<SoundId, string>();
            var expectedFileNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
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

                expectedFileNames.Add($"{soundId}-{entry.Sha256}.wav");
                var cached = await EnsureCachedAsync(soundId, entry, cancellationToken).ConfigureAwait(false);
                if (cached != null)
                {
                    refreshed[soundId] = cached;
                }
            }

            // Replace the map so sounds removed from the manifest stop overriding local defaults.
            lock (_gate)
            {
                _pathsBySound.Clear();
                foreach (var (soundId, path) in refreshed)
                {
                    _pathsBySound[soundId] = path;
                }
            }

            // Keep the disk cache small: remove old hashes and any removed sounds.
            TryCleanupCacheDir(expectedFileNames);

            _lastRefreshUtc = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sounds refresh failed");
        }
    }

    private static string GetCacheDir()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppConstants.AppDataFolderName,
            "sounds-cache");
    }

    private static string GetManifestPath() => Path.Combine(GetCacheDir(), "sounds-manifest.json");

    private bool TryLoadFromDisk()
    {
        try
        {
            var manifestPath = GetManifestPath();
            if (!File.Exists(manifestPath))
            {
                return false;
            }

            var json = File.ReadAllText(manifestPath);
            if (string.IsNullOrWhiteSpace(json))
            {
                return false;
            }

            var manifest = JsonSerializer.Deserialize<RemoteSoundManifestDto>(json, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });
            if (manifest?.Sounds == null || manifest.Sounds.Count == 0)
            {
                return false;
            }

            var cacheDir = GetCacheDir();
            if (!Directory.Exists(cacheDir))
            {
                return false;
            }

            var refreshed = new Dictionary<SoundId, string>();
            foreach (var (idString, entry) in manifest.Sounds)
            {
                if (!Enum.TryParse<SoundId>(idString, ignoreCase: true, out var soundId))
                {
                    continue;
                }
                if (string.IsNullOrWhiteSpace(entry?.Sha256))
                {
                    continue;
                }

                var fileName = $"{soundId}-{entry.Sha256}.wav";
                var destPath = Path.Combine(cacheDir, fileName);
                if (File.Exists(destPath))
                {
                    refreshed[soundId] = destPath;
                }
            }

            if (refreshed.Count == 0)
            {
                return false;
            }

            lock (_gate)
            {
                _pathsBySound.Clear();
                foreach (var (soundId, path) in refreshed)
                {
                    _pathsBySound[soundId] = path;
                }
            }

            try
            {
                _lastRefreshUtc = File.GetLastWriteTimeUtc(manifestPath);
            }
            catch
            {
                // ignore
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sound cache load failed");
            return false;
        }
    }

    private void TryFillMissingFromCacheDir()
    {
        try
        {
            var bestBySound = CollectBestCachedSounds();
            if (bestBySound.Count == 0)
            {
                return;
            }

            lock (_gate)
            {
                foreach (var kvp in bestBySound)
                {
                    if (_pathsBySound.ContainsKey(kvp.Key))
                    {
                        continue;
                    }

                    _pathsBySound[kvp.Key] = kvp.Value.Path;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sound cache scan failed");
        }
    }

    private static Dictionary<SoundId, (string Path, DateTime LastWriteUtc)> CollectBestCachedSounds()
    {
        var bestBySound = new Dictionary<SoundId, (string Path, DateTime LastWriteUtc)>();

        var cacheDir = GetCacheDir();
        if (!Directory.Exists(cacheDir))
        {
            return bestBySound;
        }

        foreach (var path in Directory.EnumerateFiles(cacheDir, "*.wav", SearchOption.TopDirectoryOnly))
        {
            var fileName = Path.GetFileName(path);
            if (string.IsNullOrWhiteSpace(fileName))
            {
                continue;
            }

            var name = Path.GetFileNameWithoutExtension(fileName);
            if (string.IsNullOrWhiteSpace(name))
            {
                continue;
            }

            var dashIndex = name.IndexOf('-');
            if (dashIndex <= 0)
            {
                continue;
            }

            var idPart = name.Substring(0, dashIndex);
            if (!Enum.TryParse<SoundId>(idPart, ignoreCase: true, out var soundId))
            {
                continue;
            }

            FileInfo info;
            try
            {
                info = new FileInfo(path);
                if (info.Length <= 0)
                {
                    continue;
                }
            }
            catch
            {
                continue;
            }

            var lastWrite = info.LastWriteTimeUtc;
            if (bestBySound.TryGetValue(soundId, out var current) &&
                current.LastWriteUtc >= lastWrite)
            {
                continue;
            }

            bestBySound[soundId] = (path, lastWrite);
        }

        return bestBySound;
    }

    private static void TrySaveManifest(string json)
    {
        try
        {
            var cacheDir = GetCacheDir();
            Directory.CreateDirectory(cacheDir);
            File.WriteAllText(GetManifestPath(), json);
        }
        catch
        {
            // ignore
        }
    }

    private void TryCleanupCacheDir(HashSet<string> expectedFileNames)
    {
        if (expectedFileNames.Count == 0)
        {
            return;
        }

        try
        {
            var cacheDir = GetCacheDir();
            if (!Directory.Exists(cacheDir))
            {
                return;
            }

            // Delete obsolete wav files (old hashes) and any leftover temp files.
            foreach (var path in Directory.EnumerateFiles(cacheDir, "*", SearchOption.TopDirectoryOnly))
            {
                var fileName = Path.GetFileName(path);
                if (string.IsNullOrWhiteSpace(fileName))
                {
                    continue;
                }

                if (fileName.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase))
                {
                    try { File.Delete(path); } catch { /* ignore */ }
                    continue;
                }

                if (!fileName.EndsWith(".wav", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!expectedFileNames.Contains(fileName))
                {
                    try { File.Delete(path); } catch { /* ignore */ }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Remote sound cache cleanup failed");
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

        var cacheDir = GetCacheDir();
        Directory.CreateDirectory(cacheDir);

        var fileName = $"{soundId}-{sha256}.wav";
        var destPath = Path.Combine(cacheDir, fileName);
        if (File.Exists(destPath))
        {
            return destPath;
        }

        var tmpPath = destPath + ".tmp";
        try
        {
            Uri uri;
            if (Uri.TryCreate(url, UriKind.Absolute, out var abs) && abs != null)
            {
                uri = abs;
            }
            else
            {
                uri = new Uri(_config.HttpBase, ".." + url.Trim());
            }

            using var req = new HttpRequestMessage(HttpMethod.Get, uri);
            using var res = await HttpClientProvider.Shared
                .SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cancellationToken)
                .ConfigureAwait(false);
            res.EnsureSuccessStatusCode();
            await using var response = await res.Content.ReadAsStreamAsync(cancellationToken).ConfigureAwait(false);
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
