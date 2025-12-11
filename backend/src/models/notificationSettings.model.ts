import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * NotificationSettings
 * TypeORM entity for storing push notification settings per device per user.
 * Preferences are stored encrypted.
 */
@Entity({ name: 'notification_settings' })
@Index(['userId', 'deviceId'], { unique: true })
export class NotificationSettings {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  deviceId!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  // Encrypted JSON string of preferences/settings
  @Column({ type: 'text', nullable: true })
  preferences?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}

export default NotificationSettings;