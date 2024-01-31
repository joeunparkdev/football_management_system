import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';

@ApiTags('통계')
@Controller('statistics')
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) {}

    /**
     * 팀 승무패 가져오기
     * @param teamId
     * @returns
     */
    @Get('/:teamId')
    async getTeamStats(@Param('teamId') teamId: number) {
        return await this.statisticsService.getTeamStats(teamId);
    }
}
