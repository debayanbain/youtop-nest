import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { ListNoticesDto } from './dto/list-notices.dto';

/**
 * Public notice board API. No auth guard — this is public catalog content with
 * no per-user state (spec Phase 7). Handlers return raw data; the global
 * ResponseTransformInterceptor adds the { success, data, ... } envelope and the
 * GlobalExceptionFilter formats errors, so nothing is hand-wrapped here.
 *
 * `types` is declared before `:id`, and `:id` is UUID-validated, so
 * /notices/types can never be swallowed by the detail route.
 */
@Controller({ path: 'notices', version: '1' })
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Get()
  list(@Query() query: ListNoticesDto) {
    return this.notices.list(query);
  }

  @Get('types')
  types() {
    return this.notices.typeCounts();
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.notices.findOne(id);
  }
}
