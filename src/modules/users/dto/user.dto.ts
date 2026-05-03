import { IsString } from 'class-validator';

export class UserDto {
  @IsString()
  clerkId: string;

  @IsString()
  firstName?: string | null;

  @IsString()
  lastName?: string | null;

  @IsString()
  emailId?: string;

  @IsString()
  imageUrl?: string | null;
}
