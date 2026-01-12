using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Serilog;
using client_win.Core.Constants;

namespace client_win.Modules.Updates.Services;

public static class DesktopShortcutDeduplicator
{
    public static void DeduplicateBestEffort()
    {
        try
        {
            var desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            if (string.IsNullOrWhiteSpace(desktop) || !Directory.Exists(desktop))
            {
                return;
            }

            // ClickOnce shortcuts are typically *.appref-ms and can be duplicated after updates as "(1)/(2)".
            // We only dedupe appref-ms files, because parsing .lnk safely would require extra dependencies.
            var candidates = Directory.EnumerateFiles(desktop, "*.appref-ms", SearchOption.TopDirectoryOnly)
                .Where(p =>
                {
                    var name = Path.GetFileNameWithoutExtension(p) ?? string.Empty;
                    return name.Contains("lila", StringComparison.OrdinalIgnoreCase) ||
                           name.Contains(AppConstants.AppName, StringComparison.OrdinalIgnoreCase);
                })
                .ToList();

            if (candidates.Count <= 1)
            {
                return;
            }

            var groups = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (var path in candidates)
            {
                var hash = ComputeSha256Hex(path);
                if (string.IsNullOrWhiteSpace(hash))
                {
                    continue;
                }
                if (!groups.TryGetValue(hash, out var list))
                {
                    list = [];
                    groups[hash] = list;
                }
                list.Add(path);
            }

            foreach (var (_, paths) in groups)
            {
                if (paths.Count <= 1)
                {
                    continue;
                }

                // Keep the "clean" name if present, else keep the shortest filename.
                var preferred = paths
                                    .FirstOrDefault(p =>
                                        string.Equals(
                                            Path.GetFileNameWithoutExtension(p),
                                            AppConstants.AppName,
                                            StringComparison.OrdinalIgnoreCase))
                                ?? paths.OrderBy(p => Path.GetFileName(p)?.Length ?? int.MaxValue)
                                    .First();

                foreach (var path in paths)
                {
                    if (string.Equals(path, preferred, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                    try
                    {
                        File.Delete(path);
                        Log.Information("Removed duplicate desktop shortcut: {Path}", path);
                    }
                    catch (Exception ex)
                    {
                        Log.Warning(ex, "Failed to remove duplicate desktop shortcut: {Path}", path);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Desktop shortcut de-duplication failed.");
        }
    }

    private static string? ComputeSha256Hex(string filePath)
    {
        try
        {
            var bytes = File.ReadAllBytes(filePath);
            var hash = SHA256.HashData(bytes);
            return Convert.ToHexString(hash);
        }
        catch
        {
            return null;
        }
    }
}

