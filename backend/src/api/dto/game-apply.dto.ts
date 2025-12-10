import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GameSingleActionDto } from '../../game/engine/dto/game-action.dto';
import { GameBaseDto } from './game-base.dto';

export class GameApplyDto extends GameBaseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GameSingleActionDto)
  actions: GameSingleActionDto[] = [];
}
