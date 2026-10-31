import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class MerchantOperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.MERCHANT_OPERATOR_KEY;
    const supplied = context
      .switchToHttp()
      .getRequest<Request>()
      .header('x-merchant-operator-key');
    // Fail closed, including in development. This is an internal pilot, not merchant login.
    if (
      !expected ||
      !supplied ||
      !timingSafeEqual(
        createHash('sha256').update(expected).digest(),
        createHash('sha256').update(supplied).digest(),
      )
    )
      throw new UnauthorizedException('Merchant operator credential required');
    return true;
  }
}
