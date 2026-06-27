import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedPartnerRequest } from './partner-api-key.guard';

export const PartnerId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<AuthenticatedPartnerRequest>();
    return request.partnerId;
  },
);
