using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using client_win.Core;

namespace client_win.Core.Network;

public static class HttpClientProvider
{
    private static readonly Lazy<HttpClient> SharedLazy = new(() =>
    {
        var handler = new SocketsHttpHandler
        {
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            PooledConnectionIdleTimeout = TimeSpan.FromMinutes(2),
        };

        var client = new HttpClient(handler, disposeHandler: true)
        {
            Timeout = Timeout.InfiniteTimeSpan
        };

        var version = AppInfo.GetShortVersion() ?? "0.0.0";
        client.DefaultRequestHeaders.UserAgent.ParseAdd($"LeMondeDeLila/{version}");
        client.DefaultRequestHeaders.TryAddWithoutValidation("x-lila-client-version", version);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        return client;
    });

    public static HttpClient Shared => SharedLazy.Value;
}

