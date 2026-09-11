import { StrictIntegerInput } from '../../../../../../platform/validation/public-api';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class AdminBugReportCommentsListWsDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: 'reportId must not be blank' })
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  reportId!: string;

  @IsOptional()
  @StrictIntegerInput()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  offset: number = 0;

  @IsOptional()
  @StrictIntegerInput()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}

export class AdminBugReportCommentAddWsDto extends AdminBugReportCommentsListWsDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: 'content must not be blank' })
  @MaxLength(20000)
  content!: string;
}
