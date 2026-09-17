import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN_ROLES } from '../common/auth/role-sets';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(...ADMIN_ROLES)
  async list(): Promise<Awaited<ReturnType<AuditService['list']>>> {
    return this.auditService.list();
  }
}
