using System;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.TextPrompts.Views;

namespace client_win.Modules.TextPrompts.Services;

public sealed class TextPromptService : ITextPromptService
{
    public Task<string?> PromptAsync(string title, string label, string initialText)
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var owner = Application.Current?.MainWindow;
            var vm = new TextPromptWindowModel
            {
                Title = string.IsNullOrWhiteSpace(title) ? "Message" : title.Trim(),
                Label = string.IsNullOrWhiteSpace(label) ? "Message" : label.Trim(),
                Text = initialText ?? string.Empty
            };

            var w = new TextPromptWindow
            {
                Owner = owner,
                DataContext = vm
            };

            bool? result = w.ShowDialog();
            if (result != true)
            {
                return (string?)null;
            }

            var text = (w.Result ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(text) ? null : text;
        }).Task;
    }
}

