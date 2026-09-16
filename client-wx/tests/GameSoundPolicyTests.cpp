#include <cassert>
#include "modules/rooms/application/GameSoundPolicy.h"

int main()
{
    using lila::modules::rooms::application::ResolveGameSound;
    using lila::modules::audio::domain::SoundCue;
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
}
