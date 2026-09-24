#include <cassert>
#include "modules/audio/application/SoundVolumeResolver.h"
#include "modules/audio/domain/SoundCatalog.h"
#include "modules/rooms/application/GameSoundPolicy.h"

int main()
{
    using lila::modules::rooms::application::ResolveGameSound;
    using lila::modules::audio::domain::SoundCue;
    assert(ResolveGameSound("dice.rolled", 7, 7, {}) == SoundCue::DiceRolled);
    assert(ResolveGameSound("card.drawn", 7, 7, {}) == SoundCue::DrawCard);
    assert(ResolveGameSound("pawn.assigned", 7, 7, {}) == SoundCue::PawnPicked);
    assert(ResolveGameSound("pawn.picked", 7, 7, {}) == SoundCue::PawnPicked);
    assert(ResolveGameSound("morpion.mark.placed", 7, 7, {}) == SoundCue::PawnPlacedSelf);
    assert(ResolveGameSound("morpion.mark.placed", -2, 7, {}) == SoundCue::PawnPlacedOpponent);
    assert(ResolveGameSound("pawn.placed", 7, 7, {}) == SoundCue::PawnPlacedSelf);
    assert(ResolveGameSound("wall.placed", -2, 7, {}) == SoundCue::WallPlacedOpponent);
    assert(ResolveGameSound("game.finished", 7, 7, {7}) == SoundCue::GameVictory);
    assert(ResolveGameSound("game.finished", -2, 7, {-2}) == SoundCue::GameDefeat);
    assert(ResolveGameSound("game.finished", 0, 7, {}) == SoundCue::RoundEnded);
    assert(!ResolveGameSound("game.message", 7, 7, {}));

    using namespace lila::modules::audio;
    application::AudioSettings settings;
    settings.selectionEnabled = false;
    settings.selectionVolume = 0;
    settings.messagesEnabled = false;
    settings.messagesVolume = 0;
    settings.navigationEnabled = false;
    for (const auto cue : {SoundCue::DiceRolled, SoundCue::DrawCard,
        SoundCue::GameVictory, SoundCue::GameDefeat, SoundCue::RoundEnded,
        SoundCue::QuizCorrect, SoundCue::QuizWrong, SoundCue::TableStarted,
        SoundCue::PawnPicked, SoundCue::PawnPlacedSelf, SoundCue::PawnPlacedOpponent,
        SoundCue::WallPlacedSelf, SoundCue::WallPlacedOpponent})
    {
        const auto* descriptor = domain::FindSoundDescriptor(cue);
        assert(descriptor);
        auto playback = application::ResolvePlaybackSettings(*descriptor, settings);
        assert(playback.enabled && playback.volume == 0.5F);
        auto& individual = settings.cues[static_cast<std::size_t>(cue)];
        individual.volume = 40;
        playback = application::ResolvePlaybackSettings(*descriptor, settings);
        assert(playback.enabled && playback.volume > 0.199F && playback.volume < 0.201F);
        individual.enabled = false;
        assert(!application::ResolvePlaybackSettings(*descriptor, settings).enabled);
        individual = {};
        settings.muteAll = true;
        assert(!application::ResolvePlaybackSettings(*descriptor, settings).enabled);
        settings.muteAll = false;
    }
    for (const auto cue : {SoundCue::Selection, SoundCue::Navigation, SoundCue::ChatMessageReceived})
        assert(!application::ResolvePlaybackSettings(*domain::FindSoundDescriptor(cue), settings).enabled);

    // Every catalogue entry must honour its own controls and the global mute.
    for (const auto& descriptor : domain::GetSoundCatalog())
    {
        application::AudioSettings defaults;
        auto playback = application::ResolvePlaybackSettings(descriptor, defaults);
        assert(playback.enabled && playback.volume > 0.0F && playback.volume <= 1.0F);
        defaults.muteAll = true;
        assert(!application::ResolvePlaybackSettings(descriptor, defaults).enabled);
        defaults.muteAll = false;
        auto& individual = defaults.cues[static_cast<std::size_t>(descriptor.cue)];
        individual.enabled = false;
        assert(!application::ResolvePlaybackSettings(descriptor, defaults).enabled);
        individual.enabled = true;
        individual.volume = 0;
        assert(application::ResolvePlaybackSettings(descriptor, defaults).volume == 0.0F);
        assert(domain::FindSoundDescriptorByServerId(descriptor.key) == &descriptor);
    }
}
