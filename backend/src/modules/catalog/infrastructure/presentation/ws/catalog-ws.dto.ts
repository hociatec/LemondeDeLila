import { IsString, MinLength } from 'class-validator';

export class CatalogCategoryDto {
  @IsString()
  @MinLength(1)
  id!: string;
}
