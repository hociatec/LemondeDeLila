using client_win.Modules.Settings.Models;
using Xunit;

namespace client_win.Tests;

public sealed class OptionsStateDefaultsTests
{
    [Fact]
    public void RepairBrokenAccents_DefaultsToTrue()
    {
        var state = new OptionsState();
        Assert.True(state.RepairBrokenAccents);
    }
}

