import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminBugReportCommentsListWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  reportId!: string;
}

export class AdminBugReportCommentAddWsDto extends AdminBugReportCommentsListWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;
}
