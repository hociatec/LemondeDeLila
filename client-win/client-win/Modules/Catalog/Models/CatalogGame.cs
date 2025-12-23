using System.Collections.Generic;

namespace client_win.Modules.Catalog.Models;

public sealed class CatalogGame
{
    public CatalogGame() { }

    public CatalogGame(string code, string name, string summary, int minPlayers, int maxPlayers, string engine, IEnumerable<string> categories)
    {
        Code = code;
        Name = name;
        Summary = summary;
        MinPlayers = minPlayers;
        MaxPlayers = maxPlayers;
        Engine = engine;
        Categories = new List<string>(categories ?? new List<string>());
    }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public int MinPlayers { get; set; }
    public int MaxPlayers { get; set; }
    public string Engine { get; set; } = string.Empty;
    public List<string> Categories { get; set; } = new();

    public override string ToString() => Name;
}
