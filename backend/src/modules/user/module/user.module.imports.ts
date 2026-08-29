import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../infrastructure/persistence/typeorm/entities/user.entity';

export const USER_MODULE_IMPORTS = [TypeOrmModule.forFeature([User])];
