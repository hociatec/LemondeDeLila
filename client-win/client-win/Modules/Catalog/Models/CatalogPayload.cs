using System;
using System.Collections.Generic;

namespace client_win.Modules.Catalog.Models;

public sealed class CatalogPayload
{
    public CatalogPayload() { }

    public CatalogPayload(IReadOnlyList<CatalogCategory> categories, IReadOnlyList<CatalogGame> games)
    {
        Categories = categories;
        Games = games;
    }

    public IReadOnlyList<CatalogCategory> Categories { get; set; } = Array.Empty<CatalogCategory>();
    public IReadOnlyList<CatalogGame> Games { get; set; } = Array.Empty<CatalogGame>();
}
