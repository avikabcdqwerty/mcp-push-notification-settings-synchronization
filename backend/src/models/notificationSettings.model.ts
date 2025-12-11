import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Entity representing notification settings for a user's device.
 * Stores encrypted notification preference per device.
 */
@Entity({ name: 'notification_settings' })
@Unique(['userId', 'deviceId'])
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ type: 'varchar', length: 128 })
  @Index()
  deviceId!: string;

  // Stores the encrypted enabled/disabled status (AES-256 encrypted JSON boolean)
  @Column({ type: 'text', nullable: false })
  enabledEncrypted!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}

export default NotificationSettings;