using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using client_win.Core.Constants;
using client_win.Modules.Catalog.Models;
using client_win.Modules.Network;
using client_win.Modules.Error;
using client_win.Modules.User.Services;

namespace client_win.Modules.Catalog.Services;

/// <summary>
/// Récupère le catalogue auprès du backend (ws route catalog.all).
/// </summary>
public sealed class CatalogService : ICatalogService
{
    private readonly WsRequestClient _ws;
    private readonly ISessionService _session;
    private readonly ErrorBus? _errors;

    public CatalogService(WsRequestClient ws, ISessionService session, ErrorBus? errors = null)
    {
        _ws = ws ?? throw new ArgumentNullException(nameof(ws));
        _session = session ?? throw new ArgumentNullException(nameof(session));
        _errors = errors;
    }

    public async Task<CatalogPayload> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        var user = _session.CurrentUser;
        string? token = user?.Token;

        var response = await _ws.RequestAsync<CatalogAllPayload>(
            WsMessageTypes.Catalog.GetAll,
            new { },
            token,
            cancellationToken).ConfigureAwait(false);

        if (!response.Success || response.Payload == null)
        {
            _errors?.Publish(new AppError(
                response.Error ?? "Chargement du catalogue impossible.",
                ErrorSeverity.Error,
                context: WsMessageTypes.ErrorContext.CatalogAll));
            return new CatalogPayload(Array.Empty<CatalogCategory>(), Array.Empty<CatalogGame>());
        }

        var categories = response.Payload.Categories ?? new List<CatalogCategory>();
        var games = response.Payload.Games ?? new List<CatalogGame>();
        return new CatalogPayload(categories, games);
    }

    private sealed class CatalogAllPayload
    {
        public List<CatalogCategory>? Categories { get; set; }
        public List<CatalogGame>? Games { get; set; }
    }
}
