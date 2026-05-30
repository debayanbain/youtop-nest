import { Controller, Get, Param, UseGuards, Optional } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { UserId } from '../../auth/user-id.decorator';
import { ClerkOptionalAuthGuard } from '../../auth/optional-auth.guard';

@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(ClerkOptionalAuthGuard)
  async getCourses(@UserId() userId: string) {
    return this.coursesService.getCourses(userId);
  }

  @Get(':slug')
  @UseGuards(ClerkOptionalAuthGuard)
  async getCourse(@Param('slug') slug: string, @UserId() userId: string) {
    return this.coursesService.getCourse(slug, userId);
  }
}
