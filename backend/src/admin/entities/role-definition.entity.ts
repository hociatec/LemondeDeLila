import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'role_definitions' })
export class RoleDefinitionEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'json' })
  permissions!: string[];
}

