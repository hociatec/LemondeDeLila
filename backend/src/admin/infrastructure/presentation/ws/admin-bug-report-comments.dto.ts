import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class AdminBugReportCommentsListWsDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: 'reportId must not be blank' })
  @MaxLength(64)
  reportId!: string;
}

export class AdminBugReportCommentAddWsDto extends AdminBugReportCommentsListWsDto {
  @IsString()
  @MinLength(1)
  @Matches(/\S/, { message: 'content must not be blank' })
  @MaxLength(50000)
  content!: string;
}






