using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using client_win.Modules.Shell.Services;
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

            FocusParking.Park(owner);
            NvdaDialogFocus.Configure(w, owner);
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
        IReadOnlyList<(string Key, string Label, string InitialText, string Kind)> fields)
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
                    var kind = (f.Kind ?? string.Empty).Trim();
                    vm.Fields.Add(new ConfigPromptFieldModel
                    {
                        Key = (f.Key ?? string.Empty).Trim(),
                        Label = string.IsNullOrWhiteSpace(f.Label) ? (f.Key ?? string.Empty).Trim() : f.Label.Trim(),
                        Kind = kind,
                        Text = f.InitialText ?? string.Empty,
                        BoolValue = ParseBoolOrDefault(f.InitialText, defaultValue: false),
                    });
                }
            }

            var w = new ConfigPromptWindow
            {
                Owner = owner,
                DataContext = vm
            };

            FocusParking.Park(owner);
            NvdaDialogFocus.Configure(w, owner);
            bool? result = w.ShowDialog();
            if (result != true)
            {
                return (Dictionary<string, string>?)null;
            }

            return w.Result;
        }).Task;
    }

    private static bool ParseBoolOrDefault(string? text, bool defaultValue)
    {
        var t = (text ?? string.Empty).Trim();
        if (t.Length == 0)
        {
            return defaultValue;
        }

        if (bool.TryParse(t, out var b))
        {
            return b;
        }

        return t.ToLowerInvariant() switch
        {
            "1" => true,
            "0" => false,
            "oui" => true,
            "non" => false,
            "yes" => true,
            "no" => false,
            "on" => true,
            "off" => false,
            _ => defaultValue
        };
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

            FocusParking.Park(owner);
            NvdaDialogFocus.Configure(w, owner);
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
