using System.Collections.Generic;
using client_win.Modules.Game.Play.GamePlay.Services;
using Xunit;

namespace client_win.Tests;

public sealed class GamePlayLogRewriterTests
{
    [Fact]
    public void RewriteForViewer_DrawWithoutCardName_InfersSingleAddedCard()
    {
        var previous = new Dictionary<string, int> { ["Croquettes"] = 0 };
        var current = new Dictionary<string, int> { ["Croquettes"] = 1 };

        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene pioche.",
            viewerUsername: "Hacene",
            previousHandCounts: previous,
            currentHandCounts: current);

        Assert.Equal("Vous piochez un Croquettes.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_DrawWithCardName_UsesServerRemainder()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene pioche Croquettes.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous piochez Croquettes.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_OpponentDraw_IsNotRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Bucky pioche une carte.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Bucky pioche une carte.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_PlayCardWithoutArticle_IsRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene joue Croquettes.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous jouez Croquettes.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_PlayCardWithArticle_IsRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene joue un 1.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous jouez un 1.", rewritten);
    }

    [Fact]
    public void RewriteForViewer_Discard_IsRewritten()
    {
        var rewritten = GamePlayLogRewriter.RewriteForViewer(
            message: "Hacene défausse Croquettes.",
            viewerUsername: "Hacene",
            previousHandCounts: null,
            currentHandCounts: null);

        Assert.Equal("Vous défaussez Croquettes.", rewritten);
    }
}

