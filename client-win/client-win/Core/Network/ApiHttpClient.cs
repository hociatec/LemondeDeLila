using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using client_win.Modules.User.Services;

namespace client_win.Core.Network;

public interface IApiHttpClient
{
    Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        TimeSpan timeout,
        CancellationToken cancellationToken = default);

    Task<HttpResponseMessage> SendAuthenticatedAsync(
        HttpRequestMessage request,
        TimeSpan timeout,
        CancellationToken cancellationToken = default);
}

public sealed class ApiHttpClient : IApiHttpClient
{
    private readonly ISessionService _session;

    public ApiHttpClient(ISessionService session)
    {
        _session = session ?? throw new ArgumentNullException(nameof(session));
    }

    public async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        if (timeout > TimeSpan.Zero)
        {
            cts.CancelAfter(timeout);
        }

        return await HttpClientProvider.Shared
            .SendAsync(request, cts.Token)
            .ConfigureAwait(false);
    }

    public Task<HttpResponseMessage> SendAuthenticatedAsync(
        HttpRequestMessage request,
        TimeSpan timeout,
        CancellationToken cancellationToken = default)
    {
        var jwt = _session.CurrentUser?.Token;
        if (string.IsNullOrWhiteSpace(jwt))
        {
            throw new InvalidOperationException("Connexion requise.");
        }

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", jwt);
        return SendAsync(request, timeout, cancellationToken);
    }
}

