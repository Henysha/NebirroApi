import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class VerifySupplier {
  @IsBoolean() verified!: boolean;
  @IsString() @Matches(/\S/) @MaxLength(1000) evidence!: string;
}
export class CreateLender {
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
}
export class GrantConsent {
  @IsString() @Matches(/\S/) @MaxLength(100) lenderId!: string;
  @Equals(true) confirmed!: boolean;
  @Equals('application-v1') scope!: string;
}
export class ReviewDecision {
  @IsIn(['APPROVED', 'DECLINED']) decision!: 'APPROVED' | 'DECLINED';
  @IsString() @Matches(/\S/) @MaxLength(1000) reason!: string;
  @IsOptional() @IsInt() @Min(1) @Max(2147483647) approvedAmountMinor?: number;
}
