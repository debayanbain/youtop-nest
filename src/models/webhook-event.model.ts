import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  Index,
} from 'sequelize-typescript';

@Table({
  tableName: 'webhook_events',
  timestamps: true,
  underscored: true,
})
export class WebhookEvent extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.TEXT,
    unique: true,
    field: 'svix_id',
  })
  declare svixId: string;

  @Column({
    type: DataType.TEXT,
    field: 'event_type',
  })
  declare eventType: string;

  @Column({
    type: DataType.JSONB,
  })
  declare payload: Record<string, unknown>;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  declare processed: boolean;

  @Column({
    type: DataType.TEXT,
    defaultValue: null,
    allowNull: true,
    field: 'error_message',
  })
  declare errorMessage: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
