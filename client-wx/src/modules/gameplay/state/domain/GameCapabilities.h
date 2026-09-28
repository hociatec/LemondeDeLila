#pragma once

// Compatibility aggregation point. New code includes the capability family it
// needs directly, so unrelated game projections do not leak into its contract.
#include "modules/gameplay/state/domain/GameAssetCapabilities.h"
#include "modules/gameplay/state/domain/GameBoardCapabilities.h"
#include "modules/gameplay/state/domain/GameCardCapabilities.h"
#include "modules/gameplay/state/domain/GamePlayerValueCapabilities.h"
#include "modules/gameplay/state/domain/GameWorkflowCapabilities.h"
