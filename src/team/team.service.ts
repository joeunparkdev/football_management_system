import { BadRequestException, Inject, Injectable, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AwsService } from '../aws/aws.service';
import { LocationService } from '../location/location.service';
import { MemberService } from '../member/member.service';
import { DataSource, Repository } from 'typeorm';
import { CreateTeamDto } from './dtos/create-team.dto';
import { TeamModel } from './entities/team.entity';
import {
    DUPLICATE_TEAM_NAME,
    EMPTY_USER,
    EXIST_CREATOR,
} from './validation-message/team-exception.message';
import { UpdateTeamDto } from './dtos/update-team.dto';
import { PaginateTeamDto } from './dtos/paginate-team-dto';
import { CommonService } from '../common/common.service';

@Injectable()
export class TeamService {
    constructor(
        @InjectRepository(TeamModel)
        private readonly teamRepository: Repository<TeamModel>,
        private readonly awsService: AwsService,
        private readonly locationService: LocationService,
        @Inject(forwardRef(() => MemberService))
        private readonly memberService: MemberService,
        private readonly dataSource: DataSource,
        private readonly commonService: CommonService,
    ) {}

    async paginateMyProfile(dto: PaginateTeamDto) {
        return await this.commonService.paginate(dto, this.teamRepository, {}, 'team');
    }

    /**
     * 팀 생성하기
     * @param createTeamDto
     * @param userId
     * @param file
     * @returns
     */
    //@Transactional()
    async createTeam(createTeamDto: CreateTeamDto, userId: number, file: Express.Multer.File) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();

        const existTeam = await this.teamRepository.findOne({
            where: {
                creator: {
                    id: userId,
                },
            },
        });
        if (existTeam) {
            throw new BadRequestException(EXIST_CREATOR);
        }

        const existTeamName = await this.teamRepository.exists({
            where: {
                name: createTeamDto.name,
            },
        });
        if (existTeamName) {
            throw new BadRequestException(DUPLICATE_TEAM_NAME);
        }

        try {
            await queryRunner.startTransaction();

            const extractLocation = this.locationService.extractAddress(createTeamDto.address);

            let findLocation = await this.locationService.findOneLocation(extractLocation);
            if (!findLocation) {
                findLocation = await this.locationService.registerLocation(
                    createTeamDto.address,
                    extractLocation,
                );
            }

            const imageUUID = await this.awsService.uploadFile(file);

            const result = this.teamRepository.create({
                ...createTeamDto,
                imageUUID: imageUUID,
                location: {
                    id: findLocation.id,
                },
                creator: { id: userId },
            });

            const savedTeam = await this.teamRepository.save(result);
            await this.memberService.registerCreaterMember(savedTeam.id, userId);

            await queryRunner.commitTransaction();

            return savedTeam;
        } catch (err) {
            console.log(err);
            await queryRunner.rollbackTransaction();
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * 팀 상세조회
     * @param teamId
     * @returns
     */
    getTeamDetail(teamId: number) {
        return this.teamRepository.findOne({
            where: {
                id: teamId,
            },
            relations: {
                creator: true,
                location: true,
            },
            select: {
                creator: {
                    id: true,
                    email: true,
                    name: true,
                },
            },
        });
    }

    /**
     * 팀 전체조회
     * @returns
     */
    async getTeams(): Promise<TeamModel[]> {
        return this.teamRepository.find();
    }

    /**
     * 팀 목록조회
     * @returns
     */
    getTeam() {
        return this.teamRepository.find({});
    }

    /**
     * 팀 수정하기
     * @param teamId
     * @param dto
     * @param file
     * @returns
     */
    async updateTeam(teamId: number, dto: UpdateTeamDto, file: Express.Multer.File) {
        try {
            if (file) {
                console.log('저장전 : ', dto['imageUrl']);
                dto['imageUUID'] = await this.awsService.uploadFile(file);
            }

            await this.teamRepository.update(
                { id: teamId },
                {
                    ...dto,
                },
            );
        } catch (err) {}
        return console.log('업데이트 성공');
    }
}
