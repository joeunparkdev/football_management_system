import { BadRequestException, HttpException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { createMatchDto } from './dtos/create-match.dto';
import { Match } from './entities/match.entity';
import { updateMatchDto } from './dtos/update-match.dto';
import { EmailService } from 'src/email/email.service';
import { EmailRequest } from './dtos/email-request.dto';
import { AuthService } from 'src/auth/auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from 'src/user/entities/user.entity';
import { deleteMatchDto } from './dtos/delete-match.dto';
import { deleteRequestDto } from './dtos/delete-request.dto';
import { createRequestDto } from './dtos/create-request.dto';
import { updateRequestDto } from './dtos/update-request.dto';
import { createMatchResultDto } from './dtos/result-match.dto';
import { MatchResult } from './entities/match-result.entity';
import { createPlayerStatsDto } from './dtos/player-stats.dto';
import { PlayerStats } from './entities/player-stats.entity';
import { TeamStats } from './entities/team-stats.entity';
import { TeamModel } from 'src/team/entities/team.entity';
import { TeamService } from 'src/team/team.service';
import { Member } from 'src/member/entities/member.entity';

@Injectable()
export class MatchService {

    constructor(
        @InjectRepository(Match)
        private matchRepository: Repository<Match>,

        @InjectRepository(User)
        private userRepository: Repository<User>,

        @InjectRepository(Member)
        private memberRepository: Repository<Member>,

        @InjectRepository(TeamModel)
        private teamRepository: Repository<TeamModel>,

        @InjectRepository(MatchResult)
        private matchResultRepository: Repository<MatchResult>,

        @InjectRepository(PlayerStats)
        private playerStatsRepository: Repository<PlayerStats>,

        @InjectRepository(TeamStats)
        private teamStatsRepository: Repository<TeamStats>,

        private emailService: EmailService,
        private authService: AuthService,
        private jwtService: JwtService,
        private configService: ConfigService,
        private readonly dataSource: DataSource,
      ) {}

    /**
     * 경기 생성 이메일 요청(상대팀 구단주에게)
     * @param userId
     * @param  createrequestDto
     * @returns
     */
    async requestCreMatch(userId: number, createrequestDto:createRequestDto) {

        //입력한 일자, 시간 예약 여부 체크
        await this.verifyReservedMatch(createrequestDto.date,createrequestDto.time);

        const token = this.authService.generateAccessEmailToken(userId);

        const homeCreator = await this.verifyTeamCreator(userId);

        const awayTeam = await this.getTeamInfo(createrequestDto.awayTeamId);

        // EmailRequest 객체 생성 및 초기화
        const emailRequest: EmailRequest = {
            email: awayTeam.creator.email,
            subject: "경기 일정 생성 요청",
            clubName: awayTeam.name,   
            originalSchedule: `${createrequestDto.date} ${createrequestDto.time}`,
            newSchedule: `${createrequestDto.date} ${createrequestDto.time}`,
            reason: '경기 제안',
            homeTeamId:createrequestDto.homeTeamId,
            awayTeamId:createrequestDto.awayTeamId,
            fieldId:createrequestDto.fieldId,
            senderName: `${homeCreator[0].name} 구단주`,
            url: `http://localhost:3000/api/match/book/accept`,
            chk: 'create',
            token:token
        };

        const send = await this.emailService.reqMatchEmail(emailRequest);

        return send ;
    }

    /**
     * 이메일 수락 후 경기 생성
     * @param  creatematchDto
     * @returns
     */
    async createMatch(creatematchDto:createMatchDto) {

        const payload = await this.jwtService.verify(creatematchDto.token, {
            secret: this.configService.get<string>("JWT_SECRET"),
        });
        const user = await this.userRepository.findOne({
            where: { id: payload.userId },
        });

        if(!user){
            throw new UnauthorizedException('사용자 정보가 유효하지 않습니다.');
        }

        //구단주 체크
        await this.verifyTeamCreator(user.id);

        const matchDate = creatematchDto.date;
        const matchTime = creatematchDto.time;

        //입력한 일자, 시간 예약 여부 체크
        await this.verifyReservedMatch(matchDate,matchTime);

        const match = this.matchRepository.create({
                        owner_id:user.id,
                        date:matchDate,
                        time:matchTime,
                        home_team_id:Number(creatematchDto.homeTeamId),
                        away_team_id:Number(creatematchDto.awayTeamId),
                        soccer_field_id:Number(creatematchDto.fieldId)
                    });

        if (!match) {
            throw new NotFoundException('경기를 생성할 수 없습니다.');
        }
        
        await this.matchRepository.save(match);

        return match;
    
    }

    /**
     * 경기 일정 조회
     * @param  matchId
     * @returns
     */
    async findOneMatch(matchId: number) {
        const match = await this.matchRepository.findOne({
            where: { id:matchId },
        });

        if(!match){
            throw new NotFoundException('해당 ID의 경기 일정이 없습니다.');
        }

        return match;
    }

    /**
     * 경기 수정 이메일 요청(상대팀 구단주에게)
     * @param  userId
     * @param  matchId
     * @param  updaterequestDto
     * @returns
     */
    async requestUptMatch(userId: number, matchId:number,updaterequestDto:updateRequestDto) {

        const token = this.authService.generateAccessEmailToken(userId);

        // 구단주 체크
        const homeCreator = await this.verifyTeamCreator(userId);

        //입력한 일자, 시간 예약 여부 체크
        await this.verifyReservedMatch(updaterequestDto.date,updaterequestDto.time);

        const match = await this.verifyOneMatch(matchId,homeCreator[0].id);

        const awayTeam = await this.getTeamInfo(match.away_team_id);

        // EmailRequest 객체 생성 및 초기화
        const emailRequest: EmailRequest = {
            email: awayTeam.creator.email, 
            subject: "경기 일정 수정 요청",
            clubName: awayTeam.name,
            originalSchedule: `${match.date} ${match.time}`,
            newSchedule: `${updaterequestDto.date} ${updaterequestDto.time}`,
            reason: updaterequestDto.reason,
            homeTeamId:0,
            awayTeamId:0,
            fieldId:0,
            senderName: `${homeCreator[0].name} 구단주`,
            url: `http://localhost:3000/api/match/${matchId}/update`,
            chk: 'update',
            token:token
        };

        const send = await this.emailService.reqMatchEmail(emailRequest);

        return send ;
    }

    /**
     * 이메일 수락 후 경기 수정
     * @param  matchId
     * @param  updatematchDto
     * @returns
     */
    async updateMatch(matchId:number,updatematchDto:updateMatchDto) {

        const payload = await this.jwtService.verify(updatematchDto.token, {
            secret: this.configService.get<string>("JWT_SECRET"),
        });
        const user = await this.userRepository.findOne({
            where: { id: payload.userId },
        });

        if(!user){
            throw new UnauthorizedException('사용자 정보가 유효하지 않습니다.');
        }

        // 구단주 체크
        await this.verifyTeamCreator(user.id);

        await this.findOneMatch(matchId);

        //입력한 일자, 시간 예약 여부 체크
        await this.verifyReservedMatch(updatematchDto.date,updatematchDto.time);

        const updateMatch = await this.matchRepository.update(
                        { id: matchId },
                        {
                            date: updatematchDto.date,
                            time: updatematchDto.time,
                        },
                    );

        return updateMatch;
    }

    /**
     * 경기 삭제 이메일 요청(상대팀 구단주에게)
     * @param  userId
     * @param  matchId
     * @param  deleterequestDto
     * @returns
     */
    async requestDelMatch(userId: number, matchId:number,deleterequestDto:deleteRequestDto) {

        const token = this.authService.generateAccessEmailToken(userId);

        // 구단주 체크
        const homeCreator = await this.verifyTeamCreator(userId);

        const match = await this.verifyOneMatch(matchId,homeCreator[0].id);

        const awayTeam = await this.getTeamInfo(match.away_team_id);

        // EmailRequest 객체 생성 및 초기화
        const emailRequest: EmailRequest = {
            email: awayTeam.creator.email,
            subject: "경기 일정 삭제 요청",
            clubName: awayTeam.name,
            originalSchedule: `${match.date} ${match.time}`,
            newSchedule: ``,
            reason: deleterequestDto.reason,
            homeTeamId:0,
            awayTeamId:0,
            fieldId:0,
            senderName: `${homeCreator[0].name} 구단주`,
            url: `http://localhost:3000/api/match/${matchId}/delete`,
            chk: 'delete',
            token:token
        };

        const send = await this.emailService.reqMatchEmail(emailRequest);

        return send ;
    }

    /**
     * 이메일 수락 후 경기 삭제
     * @param  deletematchDto
     * @param  matchId
     * @returns
     */
    async deleteMatch(deletematchDto: deleteMatchDto, matchId: number) {

        const payload = await this.jwtService.verify(deletematchDto.token, {
            secret: this.configService.get<string>("JWT_SECRET"),
        });
        const user = await this.userRepository.findOne({
            where: { id: payload.userId },
        });

        if(!user){
            throw new UnauthorizedException('사용자 정보가 유효하지 않습니다.');
        }

        // 구단주 체크
        const homeCreator = await this.verifyTeamCreator(user.id);

        await this.verifyOneMatch(matchId,homeCreator[0].id);

        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try{

            await queryRunner.manager.delete('match_results', { match_id:matchId });
            await queryRunner.manager.delete('matches', { id:matchId });

            await queryRunner.commitTransaction();

            return;

        }catch(error){
            await queryRunner.rollbackTransaction();
            console.log(`error : ${error}`);
            if (error instanceof HttpException) {
                // HttpException을 상속한 경우(statusCode 속성이 있는 경우)
                throw error;
            } else {
                // 그 외의 예외
                throw new InternalServerErrorException('서버 에러가 발생했습니다.');
            }
        }finally{
            await queryRunner.release();
        }
    }

    /**
     * 경기 결과 등록
     * @param  userId
     * @param  matchId
     * @param  creatematchResultDto
     * @returns
     */
    async resultMatchCreate(userId: number, matchId:number, creatematchResultDto:createMatchResultDto) {

        // 구단주 체크
        const homeCreator = await this.verifyTeamCreator(userId);

        const match = await this.verifyOneMatch(matchId,homeCreator[0].id);

        const matchDetail = await this.isMatchDetail(matchId,homeCreator[0].id);

        if(matchDetail){
            throw new NotFoundException('이미 경기 결과 등록했습니다.');
        }

        // 경기 결과 멤버 체크
        await this.chkResultMember(userId,matchId,creatematchResultDto);
        
        //경기 결과
        const matchResult = this.matchResultRepository.create({
            match_id:matchId,
            team_id:homeCreator[0].id,
            goals: creatematchResultDto.goals,
            corner_kick:creatematchResultDto.cornerKick,
            red_cards:creatematchResultDto.redCards,
            yellow_cards:creatematchResultDto.yellowCards,
            substitions:creatematchResultDto.substitions,
            saves:creatematchResultDto.saves,
            assists:creatematchResultDto.assists,
            passes:creatematchResultDto.passes,
            clean_sheet:creatematchResultDto.cleanSheet,
            penalty_kick:creatematchResultDto.penaltyKick,
            free_kick:creatematchResultDto.freeKick
        });

        if (!matchResult) {
            throw new NotFoundException('경기결과 기록을 생성할 수 없습니다.');
        }

        const matchResultCount = await this.matchResultCount(matchId);


        // 위 생성한 데이터 저장
        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try{
            
            await queryRunner.manager.save('match_results', matchResult);

            // 한 팀이 등록한 상태라면 팀 스탯 생성
            if(matchResultCount===1){

                const teamStats = await this.createTeamStats(matchResult);

                // 홈팀 스탯 생성
                const gethomeTeamStats = await this.teamTotalGames(match.home_team_id);

                const homeWins = gethomeTeamStats.wins + teamStats.home_win;
                const homeLoses = gethomeTeamStats.loses + teamStats.home_lose;
                const homeDraws = gethomeTeamStats.wins + teamStats.home_draw;
                const homeTotalGames = gethomeTeamStats.total_games + 1;

                const homeTeamResult = this.teamStatsRepository.create({
                    team_id: match.home_team_id,
                    wins:homeWins,
                    loses:homeLoses,
                    draws:homeDraws,
                    total_games:homeTotalGames
                });

                // 어웨이팀 스탯 생성
                const getawayTeamStats = await this.teamTotalGames(match.away_team_id);

                const awayWins = getawayTeamStats.wins + teamStats.away_win;
                const awayLoses = getawayTeamStats.loses + teamStats.away_lose;
                const awayDraws = getawayTeamStats.wins + teamStats.away_draw;
                const awayTotalGames = getawayTeamStats.total_games + 1;
    
                
                const awayTeamResult = this.teamStatsRepository.create({
                    team_id:match.away_team_id,
                    wins: awayWins,
                    loses:awayLoses,
                    draws:awayDraws,
                    total_games: awayTotalGames
                });

                await queryRunner.manager.save('team_statistics', homeTeamResult);
                await queryRunner.manager.save('team_statistics', awayTeamResult);
            }

            await queryRunner.commitTransaction();

            return matchResult;

        }catch(error){

            await queryRunner.rollbackTransaction();
            console.log(`error : ${error}`);
            if (error instanceof HttpException) {
                // HttpException을 상속한 경우(statusCode 속성이 있는 경우)
                throw error;
            } else {
                // 그 외의 예외
                throw new InternalServerErrorException('서버 에러가 발생했습니다.');
            }

        }finally{
            await queryRunner.release();
        }
    }

    /**
     * 경기 후 선수 기록 등록
     * @param  userId
     * @param  matchId
     * @param  memberId
     * @param  createplayerStatsDto
     * @returns
     */
    async resultPlayerCreate(userId: number, matchId:number, memberId:number, createplayerStatsDto: createPlayerStatsDto) {

        // 구단주 체크
        const homeCreator = await this.verifyTeamCreator(userId);

        const match = await this.verifyOneMatch(matchId,homeCreator[0].id);

        // 해당팀의 멤버인지 체크
        await this.isTeamMember(homeCreator[0].id,memberId);

        const playerStats = this.playerStatsRepository.create({
            team_id:homeCreator[0].id,
            clean_sheet: createplayerStatsDto.clean_sheet,
            match_id: match.id,
            member_id: memberId,
            assists: createplayerStatsDto.assists,
            goals: createplayerStatsDto.goals,
            yellow_cards:createplayerStatsDto.yellowCards,
            red_cards: createplayerStatsDto.redCards,
            substitutions: createplayerStatsDto.substitions,
            save: createplayerStatsDto.save,
        });

        if (!playerStats) {
        throw new NotFoundException('경기결과 기록을 생성할 수 없습니다.');
        }

        await this.playerStatsRepository.save(playerStats);

        return playerStats ;
    }

    /**
     * 팀 전체 경기 일정 조회
     * @param  teamId
     * @returns
     */
    async findTeamMatches(teamId: number) {
        const teamMatches = await this.matchRepository.findOne({
            where: [
                        { home_team_id:teamId },
                        { away_team_id:teamId }
                    ]

        });

        if (!teamMatches) {
            throw new NotFoundException('팀에서 진행한 경기가 없습니다.');
            }

        return teamMatches;
    }

    /**
     * 경기 세부 조회
     * @param  matchId
     * @returns
     */
    async findMatchDetail(matchId: number) {
        const teamMatches = await this.matchResultRepository.find({
            where: { match_id:matchId }

        });

        if (!teamMatches) {
            throw new NotFoundException('경기 기록이 없습니다.');
            }

        return teamMatches;
    }

    /**
     * 구단주 검증
     * @param  userId
     * @returns
     */
    private async verifyTeamCreator(userId:number) {

        const creator = await this.teamRepository
            .createQueryBuilder('team')
            .select(['team.id', 'team.creator_id','team.name','team.location_id'])
            .where(
                'team.creator_id=:userId',
                { userId },
            )
            .getMany();

        if (!creator[0]) {
            throw new BadRequestException('구단주가 아닙니다.');
        }

        return creator;
    }

    /**
     * 팀 정보 가져오기
     * @param  teamId
     * @returns
     */
    private async getTeamInfo(teamId:number) {

        const team = await this.teamRepository.findOne({
            where: {
                id: teamId,
            },
            relations: {
                creator: true,
            },
            select: {
                creator: {
                    name: true,
                    email: true,
                },
            },
        });

        if (!team) {
            throw new BadRequestException('팀 정보가 없습니다.');
        }

        return team;
    }

    /**
     * 경기 일정 조회+요청자 팀 검증
     * @param  matchId
     * @param  teamId
     * @returns
     */
    async verifyOneMatch(matchId: number,teamId:number) {
        const match = await this.matchRepository        
        .createQueryBuilder("match")
        .where("match.id = :matchId", { matchId })
        .andWhere(
            new Brackets(qb => {
                qb.where("match.home_team_id = :teamId", { teamId })
                    .orWhere("match.away_team_id = :teamId", { teamId });
            })
        )
        .getOne();

        if(!match){
            throw new NotFoundException('해당 ID의 경기 일정 및 경기 등록자인지 확인바랍니다.');
        }

        return match;
    }

    /**
     * 경기 후 팀 스탯 생성
     * @param  matchId
     * @param  teamId
     * @returns
     */
    async createTeamStats(matchResult:any) {

        const match = await this.findOneMatch(matchResult.match_id);

        if(!match){
            throw new NotFoundException('해당 ID의 경기 일정 및 경기 등록자인지 확인바랍니다.');
        }

        const home_team_id = match.home_team_id;
        const away_team_id = match.away_team_id;

        const home_result = await this.isMatchDetail(match.id,home_team_id);
        const away_result = await this.isMatchDetail(match.id,away_team_id);

        let home_score = 0;
        let away_score = 0;

        if(!home_result) {
            console.log(`홈 없음`);
            home_score = matchResult.goals.reduce((total, goal) => total + goal.count, 0);
            away_score = away_result.goals.reduce((total, goal) => total + goal.count, 0);
            
        }else{
            console.log(`어웨이 없음`);
            home_score = home_result.goals.reduce((total, goal) => total + goal.count, 0);
            away_score = matchResult.goals.reduce((total, goal) => total + goal.count, 0);

        }

        let home_win = 0;
        let home_lose = 0;
        let home_draw = 0;

        let away_win = 0;
        let away_lose = 0;
        let away_draw = 0;

        if(home_score>away_score){

            home_win += 1;
            away_lose += 1;

        }else if(home_score<away_score){

            away_win += 1;
            home_lose += 1;

        }else{

            home_draw += 1;
            away_draw += 1;

        }

        return {
            home_win,
            home_lose,
            home_draw,
            away_win,
            away_lose,
            away_draw
        };
    }

    /**
     * 경기 후 팀 기록 멤버 체크
     * @param  matchId
     * @param  teamId
     * @returns
     */
    async chkResultMember(userId:number,matchId:number,creatematchResultDto:createMatchResultDto) {

        // 구단주 체크
        const homeCreator = await this.verifyTeamCreator(userId);

        const teamId = homeCreator[0].id;

        // 골 멤버 체크
        creatematchResultDto.goals.forEach((x)=>{
            this.isTeamMember(teamId,x.playerId);
        })

        // 레드카드 멤버 체크
        creatematchResultDto.redCards.forEach((x)=>{
            this.isTeamMember(teamId,x.playerId);
        })

        // 옐로우카드 멤버 체크
        creatematchResultDto.yellowCards.forEach((x)=>{
            this.isTeamMember(teamId,x.playerId);
        })

        // 교체 멤버 체크
        creatematchResultDto.substitions.forEach((x)=>{
            this.isTeamMember(teamId,x.inPlayerId);
            this.isTeamMember(teamId,x.outPlayerId);
        })

        // 선방 멤버 체크
        creatematchResultDto.saves.forEach((x)=>{
            this.isTeamMember(teamId,x.playerId);
        })

        // 어시스트 멤버 체크
        creatematchResultDto.assists.forEach((x)=>{
            this.isTeamMember(teamId,x.playerId);
        })
    }

    async isMatchDetail(matchId: number,teamId:number) {
        const teamMatches = await this.matchResultRepository.findOne({
            where: { match_id:matchId, team_id:teamId }

        });

        return teamMatches;
    }

    async isTeamMember(teamId: number,memberId:number) {
        const member = await this.memberRepository        
        .createQueryBuilder("members")
        .where("members.team_id = :teamId", { teamId })
        .andWhere("members.user_id = :memberId", { memberId })
        .getOne();

        if(!member){
            const user = await this.userRepository.findOne({
                where: { id: memberId },
            });

            throw new NotFoundException(`${user.name}님은 해당 팀의 멤버가 아닙니다.`);
        }

        return member;
    }

    private async teamTotalGames(teamId: number) {
        const teamStats = await this.teamStatsRepository.findOne({
            select: ['wins','loses','draws','total_games'],
            where: { team_id:teamId },
        });

        if(!teamStats){
            return {
                wins:0,
                loses:0,
                draws:0,
                total_games:0
            };
        }

        return teamStats;
    }

    async verifyReservedMatch(date: string,time:string) {
        const existMatch = await this.matchRepository.findOne({
            where: { date,time },
        });
        if (existMatch) {
            throw new BadRequestException('이미 예약된 경기 일정 입니다.');
        }
        return existMatch;
    }

    async matchResultCount(matchId: number) {
        const count = await this.matchResultRepository.count({
            where: { match_id: matchId }
        });
    
        return count;
    }
}


