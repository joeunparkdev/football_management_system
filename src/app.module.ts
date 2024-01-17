import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configModuleValidationSchema } from './configs/env-validation.config';
import { typeOrmModuleOptions } from './configs/database.config';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { TeamMemberController } from './manager/manager.controller';
import { TeamMemberModule } from './manager/manager.module';
import { PlayerModule } from './player/player.module';
import { RedisModule } from './redis/redis.module';
import { AppService } from './app.service';
import { ChatsModule } from './chats/chats.module';
import { CommonModule } from './common/common.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggingModule } from './logging/logging.module';
import * as mongoose from 'mongoose';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configModuleValidationSchema,
    }),
    TypeOrmModule.forRootAsync(typeOrmModuleOptions),
    MongooseModule.forRoot(process.env.MONGO_URI),
    AuthModule,
    UserModule,
    TeamMemberModule,
    PlayerModule,
    RedisModule,
    ChatsModule,
    CommonModule,
    LoggingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
    mongoose.set('debug', true);
  }
}
