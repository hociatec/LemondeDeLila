using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Network;
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

    public async Task<string?> GetLatestPublishedVersionAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            // HttpBase ends with "/api/" so "../client/version" resolves to "/client/version".
            var endpoint = new Uri(_config.HttpBase, "../client/version");
            var payload = await HttpClientProvider.Shared
                .GetFromJsonAsync<ClientVersionDto>(endpoint, cancellationToken)
                .ConfigureAwait(false);
            return string.IsNullOrWhiteSpace(payload?.Version) ? null : payload!.Version!.Trim();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Impossible de récupérer la dernière version publiée.");
            return null;
        }
    }

    public string SuggestNextVersion(string? currentVersion)
    {
        var raw = (currentVersion ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return "1.0.1";
        }

        var parts = raw.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length == 1 && int.TryParse(parts[0], out var majorOnly))
        {
            return $"{majorOnly}.0.1";
        }

        if (parts.Length >= 3 &&
            int.TryParse(parts[0], out var major) &&
            int.TryParse(parts[1], out var minor) &&
            int.TryParse(parts[2], out var patch))
        {
            var nextPatch = patch + 1;
            return $"{major}.{minor}.{nextPatch}";
        }

        return raw;
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

        // Try full MSBuild.exe first (can generate setup.exe bootstrapper). If unavailable, fall back to dotnet msbuild
        // without bootstrapper (still generates *.application + Application Files).
        var fullMsbuild = FindFullMsBuildExe();
        if (!string.IsNullOrWhiteSpace(fullMsbuild) && File.Exists(fullMsbuild))
        {
            var res = await RunMsBuildPublishAsync(
                    msbuildExe: fullMsbuild,
                    projectPath: projectPath,
                    publishDir: publishDir,
                    baseUrl: baseUrl,
                    clickOnceVersion: clickOnceVersion,
                    useBootstrapper: true,
                    cancellationToken: cancellationToken)
                .ConfigureAwait(true);

            if (res.Success)
            {
                return res;
            }
        }

        // Fallback (works with dotnet SDK MSBuild but cannot generate setup.exe).
        return await RunMsBuildPublishAsync(
                msbuildExe: "dotnet",
                projectPath: projectPath,
                publishDir: publishDir,
                baseUrl: baseUrl,
                clickOnceVersion: clickOnceVersion,
                useBootstrapper: false,
                cancellationToken: cancellationToken)
            .ConfigureAwait(true);
    }

    private sealed class ClientVersionDto
    {
        [JsonPropertyName("version")]
        public string? Version { get; set; }
    }

    private async Task<ClientUpdatePublishResult> RunMsBuildPublishAsync(
        string msbuildExe,
        string projectPath,
        string publishDir,
        string baseUrl,
        string? clickOnceVersion,
        bool useBootstrapper,
        CancellationToken cancellationToken)
    {
        var isDotnet = string.Equals(msbuildExe, "dotnet", StringComparison.OrdinalIgnoreCase) ||
                       msbuildExe.EndsWith("dotnet.exe", StringComparison.OrdinalIgnoreCase);

	        var msbuildArgs = new[]
	        {
            // dotnet msbuild <proj> ... vs MSBuild.exe <proj> ...
            isDotnet ? "msbuild" : string.Empty,
            Quote(projectPath),
            "/t:Publish",
            "/restore",
            "/p:Configuration=Release",
            "/p:PublishProfile=ClickOnce",
            $"/p:PublishDir={Quote(publishDir + Path.DirectorySeparatorChar)}",
	            "/p:PublishProtocol=ClickOnce",
	            "/p:Install=true",
	            "/p:InstallFrom=Web",
	            // IMPORTANT: on désactive l'auto-update ClickOnce (qui peut afficher des boîtes système).
	            // Les mises à jour sont gérées par le client via ApplicationDeployment.Update() (silencieux).
	            "/p:UpdateEnabled=false",
	            // IMPORTANT: ClickOnce + CreateDesktopShortcut peut dupliquer le raccourci sur le bureau à chaque update.
	            "/p:CreateDesktopShortcut=false",
	            "/p:GenerateManifests=true",
            useBootstrapper ? "/p:BootstrapperEnabled=true" : "/p:BootstrapperEnabled=false",
            useBootstrapper ? "/p:IsWebBootstrapper=true" : "/p:IsWebBootstrapper=false",
            $"/p:PublishUrl={Quote(baseUrl)}",
            $"/p:InstallUrl={Quote(baseUrl)}",
            $"/p:UpdateUrl={Quote(baseUrl)}",
            !string.IsNullOrWhiteSpace(clickOnceVersion) ? $"/p:ApplicationVersion={Quote(clickOnceVersion)}" : string.Empty,
            !string.IsNullOrWhiteSpace(clickOnceVersion) ? $"/p:Version={Quote(clickOnceVersion)}" : string.Empty,
            !string.IsNullOrWhiteSpace(clickOnceVersion) ? $"/p:AssemblyVersion={Quote(NormalizeAssemblyVersion(clickOnceVersion!))}" : string.Empty,
            !string.IsNullOrWhiteSpace(clickOnceVersion) ? $"/p:FileVersion={Quote(NormalizeAssemblyVersion(clickOnceVersion!))}" : string.Empty,
        }.Where(s => !string.IsNullOrWhiteSpace(s));

        var args = string.Join(' ', msbuildArgs);

        var psi = new ProcessStartInfo
        {
            FileName = msbuildExe,
            Arguments = args,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
        };

        _logger.LogInformation("ClickOnce publish: {Exe} {Args}", msbuildExe, args);

        using var proc = Process.Start(psi);
        if (proc == null)
        {
            return new ClientUpdatePublishResult(false, "Impossible de lancer MSBuild.");
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
            var details = BuildFailureDetails(stdout, stderr);
            var bootstrapHint = useBootstrapper
                ? "\n\nAstuce: si tu n'as pas Visual Studio Build Tools, la génération de setup.exe peut échouer. La publication sans setup.exe reste possible via le fichier *.application."
                : string.Empty;
            return new ClientUpdatePublishResult(false, $"Publication ClickOnce échouée (code {proc.ExitCode}).{bootstrapHint}{details}");
        }

        return new ClientUpdatePublishResult(true, "Build OK.");
    }

    private static string NormalizeAssemblyVersion(string version)
    {
        var raw = (version ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return "1.0.0.0";
        }

        var parts = raw.Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length >= 4)
        {
            return raw;
        }

        // Ensure 4 components for AssemblyVersion/FileVersion.
        if (parts.Length == 3)
        {
            return $"{parts[0]}.{parts[1]}.{parts[2]}.0";
        }

        if (parts.Length == 2)
        {
            return $"{parts[0]}.{parts[1]}.0.0";
        }

        if (parts.Length == 1)
        {
            return $"{parts[0]}.0.0.0";
        }

        return "1.0.0.0";
    }

    private static string? FindFullMsBuildExe()
    {
        // Prefer MSBUILD_EXE_PATH if set.
        var fromEnv = Environment.GetEnvironmentVariable("MSBUILD_EXE_PATH");
        if (!string.IsNullOrWhiteSpace(fromEnv) && File.Exists(fromEnv))
        {
            return fromEnv;
        }

        // Try vswhere (Build Tools / Visual Studio).
        var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        var vswhere = Path.Combine(programFilesX86, "Microsoft Visual Studio", "Installer", "vswhere.exe");
        if (!File.Exists(vswhere))
        {
            return null;
        }

        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = vswhere,
                Arguments = "-latest -products * -requires Microsoft.Component.MSBuild -property installationPath",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };
            using var proc = Process.Start(psi);
            if (proc == null) return null;
            var output = proc.StandardOutput.ReadToEnd().Trim();
            proc.WaitForExit(5000);
            if (string.IsNullOrWhiteSpace(output)) return null;

            var candidate = Path.Combine(output, "MSBuild", "Current", "Bin", "MSBuild.exe");
            return File.Exists(candidate) ? candidate : null;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildFailureDetails(string stdout, string stderr)
    {
        var tailErr = TailLines(stderr, 20);
        var tailOut = TailLines(stdout, 20);
        if (string.IsNullOrWhiteSpace(tailErr) && string.IsNullOrWhiteSpace(tailOut))
        {
            return string.Empty;
        }
        return "\n\n--- Détails (fin du log) ---\n" +
               (!string.IsNullOrWhiteSpace(tailErr) ? ("[stderr]\n" + tailErr + "\n") : string.Empty) +
               (!string.IsNullOrWhiteSpace(tailOut) ? ("[stdout]\n" + tailOut) : string.Empty);
    }

    private static string TailLines(string text, int maxLines)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }
        var lines = text
            .Replace("\r\n", "\n", StringComparison.Ordinal)
            .Replace('\r', '\n')
            .Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length <= maxLines)
        {
            return string.Join("\n", lines);
        }
        return string.Join("\n", lines.Skip(lines.Length - maxLines));
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

        using var initReq = new HttpRequestMessage(HttpMethod.Post, initEndpoint);
        initReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        initReq.Content = JsonContent.Create(new
        {
            version = string.IsNullOrWhiteSpace(version) ? null : version.Trim(),
            message = string.IsNullOrWhiteSpace(message) ? null : message.Trim(),
            totalBytes = new FileInfo(zipPath).Length
        });

        var initResponse = await HttpClientProvider.Shared
            .SendAsync(initReq, cancellationToken)
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

            using var chunkReq = new HttpRequestMessage(HttpMethod.Post, chunkEndpoint);
            chunkReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
            chunkReq.Content = form;
            var chunkResp = await HttpClientProvider.Shared
                .SendAsync(chunkReq, cancellationToken)
                .ConfigureAwait(true);
            if (!chunkResp.IsSuccessStatusCode)
            {
                var body = await chunkResp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(true);
                _logger.LogWarning("Upload chunk failed idx={Index} {Status}: {Body}", index, chunkResp.StatusCode, body);
                return false;
            }
            index++;
        }

        using var completeReq = new HttpRequestMessage(HttpMethod.Post, completeEndpoint);
        completeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        completeReq.Content = JsonContent.Create(new { uploadId });
        var completeResp = await HttpClientProvider.Shared
            .SendAsync(completeReq, cancellationToken)
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
