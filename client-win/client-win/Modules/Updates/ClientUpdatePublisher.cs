using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.Config;
using client_win.Modules.User.Services;
using Microsoft.Extensions.Logging;

namespace client_win.Modules.Updates;

public sealed class ClientUpdatePublisher : IClientUpdatePublisher
{
    private const string DefaultClickOnceBaseUrl = "https://api.lilas.hociatec.fr/updates/client-win/";
    private readonly ClientConfiguration _config;
    private readonly ISessionService _session;
    private readonly ILogger<ClientUpdatePublisher> _logger;

    public ClientUpdatePublisher(
        ClientConfiguration config,
        ISessionService session,
        ILogger<ClientUpdatePublisher> logger)
    {
        _config = config ?? throw new ArgumentNullException(nameof(config));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ClientUpdatePublishResult> BuildAndUploadAsync(
        string? message,
        string? version,
        CancellationToken cancellationToken = default)
    {
        var token = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(token))
        {
            return new ClientUpdatePublishResult(false, "Non authentifié.");
        }

        var localSettings = UpdatePublisherLocalSettings.Load();
        var projectPath = ResolveProjectPath(localSettings);
        if (projectPath == null)
        {
            return new ClientUpdatePublishResult(
                false,
                "Projet client introuvable sur cette machine. Le build+upload depuis l'administration nécessite le repo source sur le PC Windows (ou LILA_CLIENT_PROJECT défini).");
        }

        var baseUrl = Environment.GetEnvironmentVariable("LILA_CLICKONCE_BASEURL");
        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            baseUrl = string.IsNullOrWhiteSpace(localSettings.BaseUrl) ? DefaultClickOnceBaseUrl : localSettings.BaseUrl;
        }
        if (!baseUrl.EndsWith("/", StringComparison.Ordinal))
        {
            baseUrl += "/";
        }

        var tempRoot = Path.Combine(Path.GetTempPath(), "lila-client-clickonce");
        Directory.CreateDirectory(tempRoot);
        var publishDir = Path.Combine(tempRoot, $"publish-{DateTime.UtcNow:yyyyMMdd-HHmmss}");
        Directory.CreateDirectory(publishDir);

        try
        {
            var publishResult = await RunDotnetPublishAsync(projectPath, publishDir, baseUrl, version, cancellationToken)
                .ConfigureAwait(true);
            if (!publishResult.Success)
            {
                return publishResult;
            }

            var zipPath = Path.Combine(tempRoot, $"client-win-clickonce-{DateTime.UtcNow:yyyyMMdd-HHmmss}.zip");
            if (File.Exists(zipPath))
            {
                File.Delete(zipPath);
            }
            ZipFile.CreateFromDirectory(publishDir, zipPath, CompressionLevel.Optimal, includeBaseDirectory: false);

            var uploadOk = await UploadAsync(zipPath, token, message, version, cancellationToken).ConfigureAwait(true);
            if (!uploadOk)
            {
                return new ClientUpdatePublishResult(false, "Upload échoué.");
            }

            return new ClientUpdatePublishResult(
                true,
                $"Build+upload OK. BaseUrl ClickOnce: {baseUrl}");
        }
        finally
        {
            try { Directory.Delete(publishDir, recursive: true); } catch { /* ignore */ }
        }
    }

    private static string? ResolveProjectPath(UpdatePublisherLocalSettings localSettings)
    {
        var overridePath = Environment.GetEnvironmentVariable("LILA_CLIENT_PROJECT");
        if (!string.IsNullOrWhiteSpace(overridePath) && File.Exists(overridePath))
        {
            return overridePath;
        }

        if (!string.IsNullOrWhiteSpace(localSettings.ProjectPath) && File.Exists(localSettings.ProjectPath))
        {
            return localSettings.ProjectPath;
        }

        var cwd = Directory.GetCurrentDirectory();
        var current = new DirectoryInfo(cwd);
        for (var i = 0; i < 8 && current != null; i++)
        {
            var candidate = Path.Combine(current.FullName, "client-win", "client-win", "client-win.csproj");
            if (File.Exists(candidate))
            {
                return candidate;
            }
            current = current.Parent;
        }

        return null;
    }

    private async Task<ClientUpdatePublishResult> RunDotnetPublishAsync(
        string projectPath,
        string publishDir,
        string baseUrl,
        string? version,
        CancellationToken cancellationToken)
    {
        var clickOnceVersion = TryNormalizeClickOnceVersion(version, out var normalized)
            ? normalized
            : null;

        var args = string.Join(' ', new[]
        {
            "publish",
            Quote(projectPath),
            "-c", "Release",
            "/p:PublishProfile=ClickOnce",
            $"/p:PublishDir={Quote(publishDir + Path.DirectorySeparatorChar)}",
            "/p:InstallFrom=Web",
            "/p:IsWebBootstrapper=true",
            $"/p:PublishUrl={Quote(baseUrl)}",
            $"/p:InstallUrl={Quote(baseUrl)}",
            $"/p:UpdateUrl={Quote(baseUrl)}",
            clickOnceVersion != null ? $"/p:ApplicationVersion={Quote(clickOnceVersion)}" : string.Empty,
        }.Where(s => !string.IsNullOrWhiteSpace(s)));

        var psi = new ProcessStartInfo
        {
            FileName = "dotnet",
            Arguments = args,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        _logger.LogInformation("ClickOnce publish: dotnet {Args}", args);

        using var proc = Process.Start(psi);
        if (proc == null)
        {
            return new ClientUpdatePublishResult(false, "Impossible de lancer dotnet.");
        }

        var stdoutTask = proc.StandardOutput.ReadToEndAsync();
        var stderrTask = proc.StandardError.ReadToEndAsync();

        await proc.WaitForExitAsync(cancellationToken).ConfigureAwait(true);

        var stdout = await stdoutTask.ConfigureAwait(true);
        var stderr = await stderrTask.ConfigureAwait(true);
        if (!string.IsNullOrWhiteSpace(stdout))
        {
            _logger.LogInformation("{Stdout}", stdout);
        }
        if (!string.IsNullOrWhiteSpace(stderr))
        {
            _logger.LogWarning("{Stderr}", stderr);
        }

        if (proc.ExitCode != 0)
        {
            return new ClientUpdatePublishResult(false, $"dotnet publish a échoué (code {proc.ExitCode}).");
        }

        return new ClientUpdatePublishResult(true, "Build OK.");
    }

    private static bool TryNormalizeClickOnceVersion(string? version, out string normalized)
    {
        normalized = string.Empty;
        var raw = (version ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        var parts = raw.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length is < 1 or > 4)
        {
            return false;
        }

        var nums = new int[4];
        for (var i = 0; i < parts.Length; i++)
        {
            if (!int.TryParse(parts[i], out var n) || n < 0)
            {
                return false;
            }
            nums[i] = n;
        }

        normalized = $"{nums[0]}.{nums[1]}.{nums[2]}.{nums[3]}";
        return true;
    }

    private async Task<bool> UploadAsync(string zipPath, string jwt, string? message, string? version, CancellationToken cancellationToken)
    {
        // Chunked upload keeps each request < nginx client_max_body_size (20m on this server).
        const int chunkSizeBytes = 10 * 1024 * 1024;

        var initEndpoint = new Uri(_config.HttpBase, "admin/client-updates/upload/init");
        var chunkEndpoint = new Uri(_config.HttpBase, "admin/client-updates/upload/chunk");
        var completeEndpoint = new Uri(_config.HttpBase, "admin/client-updates/upload/complete");

        using var http = new HttpClient();
        http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", jwt);

        var initResponse = await http.PostAsJsonAsync(
                initEndpoint,
                new
                {
                    version = string.IsNullOrWhiteSpace(version) ? null : version.Trim(),
                    message = string.IsNullOrWhiteSpace(message) ? null : message.Trim(),
                    totalBytes = new FileInfo(zipPath).Length
                },
                cancellationToken)
            .ConfigureAwait(true);

        if (!initResponse.IsSuccessStatusCode)
        {
            var body = await initResponse.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(true);
            _logger.LogWarning("Upload init failed {Status}: {Body}", initResponse.StatusCode, body);
            return false;
        }

        var initJson = await initResponse.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(true);
        string? uploadId = null;
        try
        {
            using var doc = JsonDocument.Parse(initJson);
            uploadId = doc.RootElement.TryGetProperty("uploadId", out var id)
                ? id.GetString()
                : null;
        }
        catch
        {
            uploadId = null;
        }
        if (string.IsNullOrWhiteSpace(uploadId))
        {
            _logger.LogWarning("Upload init: uploadId missing.");
            return false;
        }

        await using var fileStream = File.OpenRead(zipPath);
        var buffer = new byte[chunkSizeBytes];
        var index = 0;
        int read;
        while ((read = await fileStream.ReadAsync(buffer.AsMemory(0, buffer.Length), cancellationToken).ConfigureAwait(true)) > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var form = new MultipartFormDataContent();
            form.Add(new StringContent(uploadId), "uploadId");
            form.Add(new StringContent(index.ToString()), "index");

            var chunkBytes = new byte[read];
            Buffer.BlockCopy(buffer, 0, chunkBytes, 0, read);
            var chunkContent = new ByteArrayContent(chunkBytes);
            chunkContent.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
            form.Add(chunkContent, "file", $"chunk-{index}.bin");

            var chunkResp = await http.PostAsync(chunkEndpoint, form, cancellationToken).ConfigureAwait(true);
            if (!chunkResp.IsSuccessStatusCode)
            {
                var body = await chunkResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(true);
                _logger.LogWarning("Upload chunk failed idx={Index} {Status}: {Body}", index, chunkResp.StatusCode, body);
                return false;
            }
            index++;
        }

        var completeResp = await http.PostAsJsonAsync(
                completeEndpoint,
                new { uploadId },
                cancellationToken)
            .ConfigureAwait(true);

        if (!completeResp.IsSuccessStatusCode)
        {
            var body = await completeResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(true);
            _logger.LogWarning("Upload complete failed {Status}: {Body}", completeResp.StatusCode, body);
            return false;
        }
        return true;
    }

    private static string Quote(string value)
    {
        if (value.Contains('"'))
        {
            value = value.Replace("\"", "\\\"");
        }
        return value.Any(char.IsWhiteSpace) ? $"\"{value}\"" : value;
    }
}
