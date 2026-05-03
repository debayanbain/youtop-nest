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
  tableName: 'orders',
  timestamps: true,
  underscored: true,
})
export class Order extends Model {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'user_id',
  })
  declare userId: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'order_id',
  })
  declare orderId: string;

  @Column({
    type: DataType.TEXT,
    field: 'payment_id',
  })
  declare paymentId: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare amount: number;

  @Column({
    type: DataType.TEXT,
    defaultValue: 'INR',
    allowNull: false,
  })
  declare currency: string;

  @Column({
    type: DataType.TEXT,
    defaultValue: 'pending',
    allowNull: false,
  })
  declare status: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'product_type',
  })
  declare productType: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
    field: 'product_id',
  })
  declare productId: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
