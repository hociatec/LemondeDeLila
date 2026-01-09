import { Module } from '@nestjs/common';
import { GridRenderService } from './services/grid-render.service';
import { GridBlockedEdgesService } from './services/grid-blocked-edges.service';
import { GridCellActionsService } from './services/grid-cell-actions.service';

@Module({
  providers: [GridRenderService, GridBlockedEdgesService, GridCellActionsService],
  exports: [GridRenderService, GridBlockedEdgesService, GridCellActionsService],
})
export class GridModule {}
