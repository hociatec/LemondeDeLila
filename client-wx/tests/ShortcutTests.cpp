#include <cassert>
#include <functional>
#include <stdexcept>
#include "modules/shortcuts/application/ShortcutStore.h"

using namespace lila::modules::shortcuts;
class Gateway final : public application::IShortcutGateway
{
public:
    domain::ShortcutSnapshot cached{1, {{"inbox", "Messages", "CTRL+SHIFT+M", true}}, false};
    domain::ShortcutSnapshot remote{2, {{"game:chess", "Chess", "ALT+SHIFT+J", true}}, true};
    bool fail = false;
    std::function<void()> onLoad;
    domain::ShortcutSnapshot Cached(int) const override { return cached; }
    domain::ShortcutSnapshot Load(int, std::stop_token) const override
    {
        if (onLoad) onLoad();
        if (fail) throw std::runtime_error("Offline");
        return remote;
    }
    domain::ShortcutSnapshot Save(int, const domain::ShortcutSnapshot& value, std::stop_token) const override
    {
        if (fail) throw std::runtime_error("Conflict");
        auto next = value; ++next.revision; next.synchronized = true; return next;
    }
};
int main()
{
    assert(domain::ValidChord("CTRL+SHIFT+J"));
    assert(domain::ValidChord("ALT+SHIFT+F12"));
    for (const auto* chord : {"CTRL+C", "ALT+F4", "CTRL+SHIFT+C", "CTRL+SHIFT+V", "CTRL+SHIFT+X",
        "CTRL+SHIFT+Z", "CTRL+SHIFT+F13", "SHIFT+A", "CTRL+ALT+SHIFT+A"})
        assert(!domain::ValidChord(chord));
    domain::Shortcut shortcut{"game:chess", "Chess", "CTRL+SHIFT+J", true};
    assert(domain::Validate({shortcut}).empty());
    auto duplicate = shortcut; duplicate.enabled = false;
    assert(!domain::Validate({shortcut, duplicate}).empty());
    auto invalid = shortcut; invalid.target = "game:../secret";
    assert(!domain::Validate({invalid}).empty());
    invalid.target = "shell:run";
    assert(!domain::Validate({invalid}).empty());
    assert(domain::Validate({}).empty());

    auto gateway = std::make_unique<Gateway>();
    auto* fake = gateway.get();
    application::ShortcutStore store(std::move(gateway));
    store.Activate(7);
    assert(store.Load(7, {}).revision == 2);
    assert(store.Current(7).synchronized);
    assert(store.Current(99).items.empty());
    fake->fail = true;
    assert(!store.Load(7, {}).synchronized);
    assert(store.Current(7).revision == 1);
    try { (void)store.Save(7, store.Current(7), {}); assert(false); }
    catch (const std::runtime_error&) {}
    assert(store.Current(7).revision == 1);
    fake->fail = false;
    fake->onLoad = [&] { store.Activate(99); };
    (void)store.Load(7, {});
    assert(store.Current(7).items.empty());
    assert(store.Current(99).items.empty()); // A late response cannot replace another account.
    fake->onLoad = {};
    auto loaded = store.Load(99, {});
    loaded.items.clear();
    assert(store.Save(99, loaded, {}).revision == 3);
    assert(store.Current(99).items.empty());
    std::stop_source cancelled; cancelled.request_stop();
    (void)store.Load(99, cancelled.get_token());
    assert(store.Current(99).revision == 3);
    store.Activate(0);
    assert(store.Current(99).items.empty());
}
