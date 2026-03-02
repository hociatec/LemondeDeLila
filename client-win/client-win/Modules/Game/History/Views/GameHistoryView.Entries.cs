using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Documents;
using client_win.Modules.Game.History.Services;

namespace client_win.Modules.Game.History.Views;

public partial class GameHistoryView
{
    private void AppendEntries(IEnumerable<string> entries)
    {
        var paragraph = HistoryViewer.Document.Blocks.LastBlock as Paragraph;
        if (paragraph == null)
        {
            paragraph = new Paragraph();
            HistoryViewer.Document.Blocks.Add(paragraph);
        }

        foreach (var entry in entries)
        {
            if (entry == GameHistoryMessageSplitter.BlankLineToken)
            {
                paragraph.Inlines.Add(new Run(GameHistoryMessageSplitter.BlankLineToken));
                paragraph.Inlines.Add(new LineBreak());
                continue;
            }

            if (string.IsNullOrWhiteSpace(entry))
            {
                continue;
            }

            paragraph.Inlines.Add(new Run(entry));
            paragraph.Inlines.Add(new LineBreak());
        }

        if (!HistoryViewer.IsKeyboardFocusWithin)
        {
            MoveCaretAndScrollToEnd();
        }
        else
        {
            HistoryUpdatedWhileFocused?.Invoke();
        }
    }

    private void RebuildFromViewModel(bool scrollToEnd)
    {
        if (_viewModel == null)
        {
            return;
        }

        HistoryViewer.Document.Blocks.Clear();
        var paragraph = new Paragraph();
        foreach (var entry in _viewModel.Entries)
        {
            if (entry == GameHistoryMessageSplitter.BlankLineToken)
            {
                paragraph.Inlines.Add(new Run(GameHistoryMessageSplitter.BlankLineToken));
                paragraph.Inlines.Add(new LineBreak());
                continue;
            }

            if (string.IsNullOrEmpty(entry))
            {
                continue;
            }

            paragraph.Inlines.Add(new Run(entry));
            paragraph.Inlines.Add(new LineBreak());
        }
        HistoryViewer.Document.Blocks.Add(paragraph);

        if (scrollToEnd && !HistoryViewer.IsKeyboardFocusWithin)
        {
            MoveCaretAndScrollToEnd();
        }
        else if (HistoryViewer.IsKeyboardFocusWithin)
        {
            HistoryUpdatedWhileFocused?.Invoke();
        }
    }

    private void AttachAppActivationHooks()
    {
        try
        {
            if (Application.Current == null) return;
            Application.Current.Deactivated -= OnAppDeactivated;
            Application.Current.Deactivated += OnAppDeactivated;
        }
        catch
        {
        }
    }

    private void DetachAppActivationHooks()
    {
        try
        {
            if (Application.Current == null) return;
            Application.Current.Deactivated -= OnAppDeactivated;
        }
        catch
        {
        }
    }

    private void OnAppDeactivated(object? sender, EventArgs e)
    {
        CancelPendingAnnouncementsFromHost();
        _announcerController.CancelScreenReaderSpeech();
    }
}
