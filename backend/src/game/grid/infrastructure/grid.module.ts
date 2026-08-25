import { Module } from '@nestjs/common';
import { GridBlockedEdgesService } from '../application/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../application/services/grid-cell-actions.service';
import { GridRenderService } from '../application/services/grid-render.service';

@Module({
  providers: [
    GridRenderService,
    GridBlockedEdgesService,
    GridCellActionsService,
  ],
  exports: [GridRenderService, GridBlockedEdgesService, GridCellActionsService],
})
export class GridModule {}




