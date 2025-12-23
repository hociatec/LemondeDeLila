namespace client_win.Core;

public interface IViewFactory<TView>
{
    TView Create();
}
