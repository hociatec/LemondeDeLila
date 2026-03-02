using client_win.Modules.Catalog.Models;
using Xunit;

namespace client_win.Tests;

public sealed class CatalogGameDisplayNameTests
{
    [Fact]
    public void DisplayName_HidesFinishedStatus()
    {
        var game = new CatalogGame
        {
            Name = "Mon Jeu",
            Status = "finished"
        };

        Assert.Equal("Mon Jeu", game.DisplayName);
    }

    [Fact]
    public void DisplayName_ShowsOnlyConstructionAndBeta()
    {
        var beta = new CatalogGame
        {
            Name = "Jeu Beta",
            Status = "beta"
        };
        var construction = new CatalogGame
        {
            Name = "Jeu Construction",
            Status = "construction"
        };

        Assert.Equal("Jeu Beta (B\u00eata)", beta.DisplayName);
        Assert.Equal("Jeu Construction (En construction)", construction.DisplayName);
    }
}
