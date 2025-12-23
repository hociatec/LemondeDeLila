using System.Collections.Generic;

namespace client_win.Modules.Catalog.Models;

public sealed class CatalogCategory
{
    public CatalogCategory() { }

    public CatalogCategory(string id, string name, IEnumerable<CatalogCategory>? children = null)
    {
        Id = id;
        Name = name;
        Children = new List<CatalogCategory>(children ?? new List<CatalogCategory>());
    }

    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public List<CatalogCategory> Children { get; set; } = new();

    public override string ToString() => Name;
}
