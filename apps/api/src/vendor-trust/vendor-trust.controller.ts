import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { VendorTrustService } from './vendor-trust.service';

@Controller('vendor-trust')
export class VendorTrustController {
  constructor(private readonly svc: VendorTrustService) {}

  @Post('compute')
  computeAll() {
    return this.svc.computeAllScores();
  }

  @Get('top')
  getTop(@Query('limit') limit?: string) {
    return this.svc.getTopVendors(+(limit || 30));
  }

  @Get('distribution')
  getDistribution() {
    return this.svc.getDistribution();
  }

  @Get(':vendorCompanyId')
  getVendorScore(@Param('vendorCompanyId') id: string) {
    return this.svc.getVendorScore(id);
  }
}
