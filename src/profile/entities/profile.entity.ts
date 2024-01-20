import { Exclude } from 'class-transformer';
import {
    IsDate,
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsString,
    IsStrongPassword,
} from 'class-validator';
import { UserStatus } from '../../enums/user-status.enum';
import { Gender } from '../../enums/gender.enum';
import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    JoinTable,
    ManyToMany,
    OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { Position } from 'src/user/types/position.type';
import { User } from 'src/user/entities/user.entity';
import { Factory } from 'nestjs-seeder';
import { LocationModel } from 'src/location/entities/location.entity';

@Entity('profile')
export class Profile {
    @PrimaryGeneratedColumn()
    id: number;

    /**
     * 실력
     * @example "9"
     */
    @Column({ nullable: true })
    skill_level: number;

    /**
     * 몸무게
     * @example "59"
     */
    @Column({ nullable: true })
    weight: number;

    /**
     * 키
     * @example "159"
     */
    @Column({ nullable: true })
    height: number;

    /**
     * 포지션
     * @example "우측 윙어"
     */
    @IsEnum(Position)
    @Column({
        type: 'enum',
        enum: Position,
        default: Position.AttackingMidfielder,
    })
    preferred_position: Position;

    /**
     * 사진 url
     * @example "사진url"
     */
    @IsString()
    @Column({ nullable: true })
    imageUrl: string;

    /**
     * 나이
     * @example "18"
     */
    @Column({ nullable: true })
    age: number;

    /**
     * 휴대폰 번호
     * @example "010-000-0000"
     */

    @IsString()
    @Column({ nullable: true })
    phone: string;

    /**
     * 생년월일
     * @example "7001010"
     */
    @IsDate()
    @Column({ nullable: true })
    birthdate: Date;

    /**
     * 성별
     * @example "Male"
     */
    @IsEnum(Gender)
    @Column({ nullable: false, default: Gender.Female })
    gender: Gender;

    /**
     * 위치
     * @example "Location_id"
     */
    @OneToOne(() => LocationModel, (location) => location.profile)
    @JoinColumn()
    location: LocationModel;

    /**
     * 유저 아이디
     * @example "1"
     */
    @OneToOne(() => User, (user) => user.profile)
    @JoinColumn()
    user: User;

    /**
     * 선수 이름
     * @example "김메시"
     */

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @Column()
    deletedAt: Date;
}
