#include <cassert>
#include <nlohmann/json.hpp>
#include "modules/audio/application/AudioService.h"
#include "modules/audio/application/IAudioBackend.h"
#include "modules/audio/application/IAudioSettingsProvider.h"
#include "modules/audio/infrastructure/NotificationAudioDecoder.h"
#include "modules/gameplay/state/infrastructure/GameSystemDecoder.h"
#include "modules/gameplay/events/application/GameSoundEventPolicy.h"
#include "modules/chat/application/ChatMessageStore.h"

using namespace lila::modules;
using Cue = audio::domain::SoundCue;
using Json = nlohmann::json;

struct Settings : audio::application::IAudioSettingsProvider
{
    audio::application::AudioSettings Snapshot() const override { return {}; }
};
struct Backend : audio::application::IAudioBackend
{
    int loopCalls = 0, refreshes = 0, graceful = 0;
    std::optional<Cue> loop;
    void Preload(Cue) override {}
    void Play(Cue, float) override {}
    void SetLoop(std::optional<Cue> cue, float) override { loop = cue; ++loopCalls; }
    void StopAll() override { loop.reset(); }
    void InterruptPlayback() noexcept override {}
    void Shutdown() noexcept override {}
    void ShutdownGracefully() noexcept override { ++graceful; }
    void RefreshAssets() override { ++refreshes; }
};

void TestNotifications()
{
    audio::infrastructure::NotificationAudioDecoder decoder;
    const auto decode = [&](std::string type, Json payload)
        { return decoder.Decode(Json{{"type", type}, {"payload", payload}}.dump(), 7); };
    assert(!decode("notify.counts", {{"messages", 42}}).cue);
    assert(!decode("notify.inbox.snapshot", {{"items", Json::array()}}).cue);
    assert(decode("notify.connected", Json::object()).refreshAssets);
    assert(decode("messaging.message", {{"messageId", 1}}).cue == Cue::PrivateMessageReceived);
    assert(!decode("messaging.message", {{"messageId", 1}}).cue);
    assert(decode("social.friend.requested", {{"requesterId", 8}, {"requestId", 11}}).cue == Cue::FriendInvitationReceived);
    assert(decode("social.friend.requested", {{"requesterId", 8}, {"requestId", 12}}).cue == Cue::FriendInvitationReceived);
    const Json item{{"kind", "admin_contact"}, {"id", "a"}, {"fromUserId", 8}};
    assert(decode("notify.inbox.item", item).cue == Cue::AdminContactReceived);
    assert(!decode("notify.inbox.item", item).cue);
    assert(!decode("notify.inbox.item", {{"kind", "admin_contact"}, {"id", "b"}, {"fromUserId", 7}}).cue);
    assert(decode("bugReports.comment.added", {{"commentId", "c"}, {"createdByUserId", 8}}).cue == Cue::BugReportCommentReceived);
    assert(!decode("bugReports.comment.added", {{"commentId", "d"}, {"createdByUserId", 7}}).cue);
    assert(decode("client.update.required", {{"version", "2"}}).cue == Cue::ClientUpdateWarning);
    assert(decode("sounds.updated", {{"updatedAt", "now"}}).refreshAssets);
    assert(!decode("sounds.updated", {{"updatedAt", "now"}}).refreshAssets);
    assert(!decoder.Decode("broken", 7).cue);
    assert(!decoder.Decode(R"({"type":42,"payload":{}})", 7).cue);
    decoder.Reset();
    assert(decode("messaging.message", {{"messageId", 1}}).cue);
}

void TestGameEvents()
{
    const auto decode = [](const Json& events)
        { return gameplay::infrastructure::GameSystemDecoder::Decode({{"events", {{"recent", events}}}}).events; };
    const auto event = [](std::string type, Json data, std::string id)
        { return Json{{"id", id}, {"type", type}, {"occurredAtMs", 1}, {"data", data}}; };
    const auto revealed = event("quiz.revealed", {{"sessionId", "q1"}, {"correctAnswerIndex", 1}, {"answers", {{"7", 1}, {"8", 0}}}}, "1");
    const auto semantic = event("game.message", {{"key", "game.quiz.answered"},
        {"params", {{"sessionId", "q1"}, {"playerId", 7}, {"correct", true}}}}, "2");
    auto batch = decode(Json::array({revealed, semantic}));
    using gameplay::application::GameSoundEventType;
    assert(GameSoundEventType(batch[0], batch, 7) == "quiz.correct");
    assert(GameSoundEventType(batch[0], batch, 8) == "quiz.wrong");
    assert(GameSoundEventType(batch[0], batch, 9).empty());
    assert(GameSoundEventType(batch[1], batch, 7).empty()); // No duplicate semantic sound.
    auto nextQuestion = semantic;
    nextQuestion["data"]["params"]["sessionId"] = "q2";
    batch = decode(Json::array({revealed, nextQuestion}));
    assert(GameSoundEventType(batch[1], batch, 7) == "quiz.correct");
    batch = decode(Json::array({semantic}));
    assert(batch[0].details.playerId == 7);
    assert(GameSoundEventType(batch[0], batch, 7) == "quiz.correct");
    batch = decode(Json::array({event("game.message", {{"key", "game.quiz.answered"},
        {"params", {{"playerId", 7}, {"correct", false}}}}, "3")}));
    assert(GameSoundEventType(batch[0], batch, 7) == "quiz.wrong");
    batch = decode(Json::array({event("quiz.answered", {{"playerId", 7}}, "4")}));
    assert(GameSoundEventType(batch[0], batch, 7) == "quiz.answered"); // Not mapped to correctness.
    batch = decode(Json::array({event("game.message", {{"key", "game.grid.wall.placed"},
        {"params", {{"playerId", 8}}}}, "5")}));
    assert(batch[0].details.playerId == 8);
    assert(GameSoundEventType(batch[0], batch, 7) == "wall.placed");
}

void TestAmbienceLifecycle()
{
    Settings settings;
    Backend backend;
    audio::application::AudioService service(backend, settings);
    service.StartTableAmbience("TableAmbience1");
    service.SetBackground(audio::domain::AudioBackground::MainMenu);
    auto calls = backend.loopCalls;
    service.SetTableAmbienceVolume(50);
    assert(backend.loopCalls == calls && backend.loop == Cue::MainMenuMusic);
    service.StartTableAmbience("TableAmbience2");
    service.StopLoop();
    calls = backend.loopCalls;
    service.SetTableAmbienceVolume(70);
    assert(backend.loopCalls == calls && !backend.loop);
    service.StartTableAmbience("TableAmbience3");
    service.StopAll();
    calls = backend.loopCalls;
    service.SetTableAmbienceVolume(80);
    assert(backend.loopCalls == calls && !backend.loop);
    service.RefreshAssets();
    assert(backend.refreshes == 1);
    service.ShutdownGracefully();
    service.StartTableAmbience("TableAmbience1");
    service.RefreshAssets();
    assert(backend.loopCalls == calls && backend.refreshes == 1 && backend.graceful == 1);
}

void TestChatDuplicates()
{
    chat::application::ChatMessageStore store;
    chat::domain::ChatMessage message;
    message.id = "first";
    message.text = "Hello";
    assert(store.UpsertMessage(message));
    assert(!store.UpsertMessage(message));
    message.text = "Edited";
    assert(!store.UpsertMessage(message));
    assert(store.Snapshot()[0].text == "Edited");
    store.LoadHistory({message}, 10);
    assert(!store.UpsertMessage(message));
}

int main()
{
    TestNotifications();
    TestGameEvents();
    TestAmbienceLifecycle();
    TestChatDuplicates();
}
