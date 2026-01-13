using System;
using System.Collections.Generic;
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

    public Task<Dictionary<string, string>?> PromptConfigAsync(
        string title,
        IReadOnlyList<(string Key, string Label, string InitialText)> fields)
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var owner = Application.Current?.MainWindow;
            var vm = new ConfigPromptWindowModel
            {
                Title = string.IsNullOrWhiteSpace(title) ? "Configuration" : title.Trim(),
            };

            if (fields != null)
            {
                foreach (var f in fields)
                {
                    vm.Fields.Add(new ConfigPromptFieldModel
                    {
                        Key = (f.Key ?? string.Empty).Trim(),
                        Label = string.IsNullOrWhiteSpace(f.Label) ? (f.Key ?? string.Empty).Trim() : f.Label.Trim(),
                        Text = f.InitialText ?? string.Empty
                    });
                }
            }

            var w = new ConfigPromptWindow
            {
                Owner = owner,
                DataContext = vm
            };

            bool? result = w.ShowDialog();
            if (result != true)
            {
                return (Dictionary<string, string>?)null;
            }

            return w.Result;
        }).Task;
    }

    public Task<(string Subject, string Message)?> PromptPrivateMessageAsync(
        string title,
        string subjectLabel,
        string messageLabel,
        string initialSubject,
        string initialMessage)
    {
        return Application.Current.Dispatcher.InvokeAsync(() =>
        {
            var owner = Application.Current?.MainWindow;
            var vm = new PrivateMessagePromptWindowModel
            {
                Title = string.IsNullOrWhiteSpace(title) ? "Message privé" : title.Trim(),
                SubjectLabel = string.IsNullOrWhiteSpace(subjectLabel) ? "Sujet" : subjectLabel.Trim(),
                MessageLabel = string.IsNullOrWhiteSpace(messageLabel) ? "Message" : messageLabel.Trim(),
                Subject = initialSubject ?? string.Empty,
                Message = initialMessage ?? string.Empty
            };

            var w = new PrivateMessagePromptWindow
            {
                Owner = owner,
                DataContext = vm
            };

            bool? result = w.ShowDialog();
            if (result != true)
            {
                return ((string Subject, string Message)?)null;
            }

            var subject = (w.Result?.Subject ?? string.Empty).Trim();
            var message = (w.Result?.Message ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(message))
            {
                return ((string Subject, string Message)?)null;
            }

            return (subject, message);
        }).Task;
    }
}
