import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateMerchant {
  @IsString() @Matches(/\S/) @MaxLength(120) name!: string;
  @IsString() @Matches(/\S/) @MaxLength(120) market!: string;
}
export class CreateOffer {
  @IsString() @Matches(/\S/) @MaxLength(100) merchantId!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) commodity!: string;
  @IsInt() @Min(1) @Max(1000000) availableKg!: number;
  @IsInt() @Min(1) @Max(100000000) pricePerKgMinor!: number;
}
export class AgreeTrade {
  @IsString() @Matches(/\S/) @MaxLength(100) offerId!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) buyerId!: string;
  @IsString() @Matches(/^[a-zA-Z0-9_-]{8,100}$/) requestKey!: string;
  @IsInt() @Min(1) @Max(1000000) quantityKg!: number;
}
export class DeliveryEvidence {
  @IsString() @Matches(/\S/) @MaxLength(1000) evidence!: string;
}
export class PaymentEvidence extends DeliveryEvidence {
  @IsString() @Matches(/^[A-Z0-9_-]{2,40}$/) provider!: string;
  @IsString() @Matches(/^[A-Z0-9_-]{3,120}$/) reference!: string;
  @IsInt() @Min(1) @Max(2147483647) amountMinor!: number;
}
export class RequestFinancing {
  @IsString() @Matches(/\S/) @MaxLength(100) tradeId!: string;
  @IsInt() @Min(1) @Max(2147483647) amountMinor!: number;
  @IsString() @Matches(/\S/) @MaxLength(1000) purpose!: string;
}
