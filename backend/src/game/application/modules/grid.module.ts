import { Module } from '@nestjs/common';
import { GridBlockedEdgesService } from '../features/grid/services/grid-blocked-edges.service';
import { GridCellActionsService } from '../features/grid/services/grid-cell-actions.service';
import { GridRenderService } from '../features/grid/services/grid-render.service';

@Module({
  providers: [
    GridRenderService,
    GridBlockedEdgesService,
    GridCellActionsService,
  ],
  exports: [GridRenderService, GridBlockedEdgesService, GridCellActionsService],
})
export class GridModule {}




