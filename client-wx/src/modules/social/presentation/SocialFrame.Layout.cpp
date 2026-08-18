#include "modules/social/presentation/SocialFrame.h"

// SocialView est compilée depuis cette unité existante afin de conserver
// la compatibilité avec les projets qui listent explicitement les .cpp.
#include "modules/social/presentation/SocialView.inl"

// Presentation formatting/mapping kept outside SocialFrame while compiled from an existing unit.
#include "modules/social/presentation/SocialPresentationModel.inl"
#include "modules/social/presentation/SocialSelectionMemory.inl"
#include "modules/social/presentation/SocialDataStore.inl"
#include "modules/social/presentation/SocialActionController.inl"

// Section/widget synchronization compiled from an existing unit.
#include "modules/social/presentation/SocialSectionPresenter.inl"
