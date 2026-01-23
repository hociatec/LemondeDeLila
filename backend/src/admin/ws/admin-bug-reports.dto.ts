import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminBugReportCreateWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content!: string;
}

export class AdminBugReportIdWsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  id!: string;
}

export class AdminBugReportsListWsDto {
  @IsOptional()
  @IsString()
  _noop?: string;
}

export class AdminBugReportUpdateWsDto extends AdminBugReportIdWsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50000)
  content?: string;
}

export class AdminBugReportUpdateStatusWsDto extends AdminBugReportIdWsDto {
  @IsString()
  @IsIn(['pending', 'in_progress', 'to_test', 'done', 'refused', 'rejected'])
  status!:
    | 'pending'
    | 'in_progress'
    | 'to_test'
    | 'done'
    | 'refused'
    | 'rejected';
}
