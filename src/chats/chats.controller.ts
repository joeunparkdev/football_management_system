import { Controller, Get, Query } from '@nestjs/common';
import { ChatsService } from './chats.service';
import { PaginateChatDto } from './dto/paginate-chat.dto';

@Controller('chats')
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  // @Get()
  // async getAllChats() {
  //   return await this.chatsService.getAllChats();
  // }
  @Get()
  paginateChat(@Query() dto: PaginateChatDto) {
    return this.chatsService.paginateChat(dto);
  }
}
