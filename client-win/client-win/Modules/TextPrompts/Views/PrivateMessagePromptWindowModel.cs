using client_win.Core;

namespace client_win.Modules.TextPrompts.Views;

public sealed class PrivateMessagePromptWindowModel : ObservableObject
{
    private string _title = "Message privé";
    private string _subjectLabel = "Sujet";
    private string _messageLabel = "Message";
    private string _subject = string.Empty;
    private string _message = string.Empty;

    public string Title
    {
        get => _title;
        set => SetProperty(ref _title, value);
    }

    public string SubjectLabel
    {
        get => _subjectLabel;
        set => SetProperty(ref _subjectLabel, value);
    }

    public string MessageLabel
    {
        get => _messageLabel;
        set => SetProperty(ref _messageLabel, value);
    }

    public string Subject
    {
        get => _subject;
        set => SetProperty(ref _subject, value);
    }

    public string Message
    {
        get => _message;
        set => SetProperty(ref _message, value);
    }
}

