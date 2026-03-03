using System;
using System.Linq;
using System.Reflection;
using client_win.Modules.Config;
using client_win.Modules.Updates;
using Xunit;

namespace client_win.Tests;

public sealed class ClientUpdateManagerUrlResolutionTests
{
    [Fact]
    public void ResolveUpdateUrl_AcceptsAbsoluteHttpsUrl()
    {
        var config = CreateConfig(
            httpBase: "https://api.test.local/api/",
            updatesCheckUrl: "https://api.test.local/client/version");

        var url = ResolveUpdateUrl(config, "https://cdn.test.local/updates/client-win/");

        Assert.Equal("https://cdn.test.local/updates/client-win/", url);
    }

    [Fact]
    public void ResolveUpdateUrl_NormalizesRelativeServerUrl()
    {
        var config = CreateConfig(
            httpBase: "https://api.test.local/api/",
            updatesCheckUrl: "https://api.test.local/client/version");

        var url = ResolveUpdateUrl(config, "/updates/client-win/");

        Assert.Equal("https://api.test.local/updates/client-win/", url);
    }

    [Fact]
    public void ResolveUpdateUrl_RejectsUnsupportedScheme_AndFallsBack()
    {
        var config = CreateConfig(
            httpBase: "https://api.test.local/api/",
            updatesCheckUrl: "https://api.test.local/client/version");

        var url = ResolveUpdateUrl(config, "file:///tmp/update.application");

        Assert.Equal("https://api.test.local/updates/client-win/", url);
    }

    [Fact]
    public void ResolveUpdateUrl_UsesFallbackWhenServerUrlInvalid()
    {
        var config = CreateConfig(
            httpBase: "https://api.test.local/api/",
            updatesCheckUrl: "https://api.test.local/client/version");

        var url = ResolveUpdateUrl(config, "://invalid-url");

        Assert.Equal("https://api.test.local/api/://invalid-url", url);
    }

    private static string? ResolveUpdateUrl(ClientConfiguration config, string? serverUrl)
    {
        var method = typeof(ClientUpdateManager).GetMethod(
            "ResolveUpdateUrl",
            BindingFlags.Static | BindingFlags.NonPublic);

        Assert.NotNull(method);
        return method!.Invoke(null, new object?[] { config, serverUrl }) as string;
    }

    private static ClientConfiguration CreateConfig(string httpBase, string updatesCheckUrl)
    {
        var ctor = typeof(ClientConfiguration)
            .GetConstructors(BindingFlags.Instance | BindingFlags.NonPublic)
            .Single();

        return (ClientConfiguration)ctor.Invoke(
            new object?[]
            {
                "Test App",
                new Uri(httpBase),
                new Uri("wss://ws.test.local/ws/api"),
                new Uri("wss://ws.test.local/ws"),
                new Uri("wss://ws.test.local/presence"),
                new Uri("wss://ws.test.local/ws/notify"),
                new Uri("wss://ws.test.local/ws/game"),
                new Uri(updatesCheckUrl),
                "issuer",
                null,
                null,
                null,
            });
    }
}

