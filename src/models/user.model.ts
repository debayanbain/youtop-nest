import {
  Column,
  Model,
  Table,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

@Table({
  tableName: 'users',
  timestamps: true,
  underscored: true,
})
export class User extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    unique: true,
    field: 'clerk_id',
  })
  declare clerkId: string;

  @Column({
    type: DataType.TEXT,
    field: 'first_name',
  })
  declare firstName: string;

  @Column({
    type: DataType.TEXT,
    field: 'last_name',
  })
  declare lastName: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    unique: true,
    field: 'email_id',
  })
  declare emailId: string;

  @Column({
    type: DataType.BIGINT,
    field: 'mobile_number',
  })
  declare mobileNumber: number;

  @Column({
    type: DataType.TEXT,
    field: 'image_url',
  })
  declare imageUrl: string;

  @Column({
    type: DataType.ENUM('user', 'admin'),
    defaultValue: 'user',
    allowNull: false,
  })
  declare role: 'user' | 'admin';

  @Column({
    type: DataType.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
    allowNull: false,
  })
  declare status: 'active' | 'inactive' | 'suspended';

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
