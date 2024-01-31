
import { Module } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { StatisticsController } from './statistics.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeamStats } from '../match/entities/team-stats.entity';
import { MatchResult } from '../match/entities/match-result.entity';
import { PlayerStats } from '../match/entities/player-stats.entity';

@Module({
    imports: [TypeOrmModule.forFeature([TeamStats, MatchResult, PlayerStats])],
    controllers: [StatisticsController],
    providers: [StatisticsService],
})
export class StatisticsModule {}
