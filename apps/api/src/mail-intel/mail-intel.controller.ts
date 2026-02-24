import { Controller, Get, Post, Param, Query, Res, Body, Headers } from '@nestjs/common';
import { Response } from 'express';
import { MailIntelService } from './mail-intel.service';

@Controller('mail-intel')
export class MailIntelController {
  constructor(private readonly svc: MailIntelService) {}

  @Get('overview')
  getOverview() { return this.svc.getOverview(); }

  @Get('sync-status')
  getSyncStatus() { return this.svc.getSyncStatus(); }

  /* ═══ Vendors ═══ */
  @Get('vendors')
  getVendors(
    @Query('page') page?: string, @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string,
  ) { return this.svc.getVendors(+(page || 1), +(pageSize || 25), search, dateFrom, dateTo); }

  @Get('vendors/:id')
  getVendorDetail(@Param('id') id: string) { return this.svc.getVendorDetail(id); }

  @Get('vendor-contacts')
  getVendorContacts(
    @Query('vendorId') vendorId?: string, @Query('page') page?: string,
    @Query('pageSize') pageSize?: string, @Query('search') search?: string,
  ) { return this.svc.getVendorContacts(vendorId, +(page || 1), +(pageSize || 25), search); }

  /* ═══ Consultants ═══ */
  @Get('consultants')
  getConsultants(
    @Query('page') page?: string, @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string,
  ) { return this.svc.getConsultants(+(page || 1), +(pageSize || 25), search, dateFrom, dateTo); }

  @Get('consultants/:id')
  getConsultantDetail(@Param('id') id: string) { return this.svc.getConsultantDetail(id); }

  /* ═══ Clients ═══ */
  @Get('clients')
  getClients(
    @Query('page') page?: string, @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string,
  ) { return this.svc.getClients(+(page || 1), +(pageSize || 25), search, dateFrom, dateTo); }

  @Get('clients/:id')
  getClientDetail(@Param('id') id: string) { return this.svc.getClientDetail(id); }

  /* ═══ Req Signals ═══ */
  @Get('req-signals')
  getReqSignals(
    @Query('page') page?: string, @Query('pageSize') pageSize?: string,
    @Query('empType') empType?: string, @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string,
  ) { return this.svc.getReqSignals(+(page || 1), +(pageSize || 25), empType, search, dateFrom, dateTo); }

  @Get('req-signals/:id/matches')
  getReqWithMatches(@Param('id') id: string) { return this.svc.getReqWithMatches(id); }

  /* ═══ Step 3: Req → Job Pipeline ═══ */
  @Post('req-signals/:id/convert')
  convertReqToJob(@Param('id') id: string, @Headers('x-tenant-id') tenantId: string) {
    return this.svc.convertReqToJob(id, tenantId || 'default');
  }

  @Post('req-signals/bulk-convert')
  bulkConvertReqs(
    @Body() body: { empType?: string; dateFrom?: string; dateTo?: string; limit?: number },
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.svc.bulkConvertReqs(body, tenantId || 'default');
  }

  /* ═══ Skills ═══ */
  @Get('skills-demand')
  getSkillsDemand() { return this.svc.getSkillsDemand(); }

  @Get('skills-supply')
  getSkillsSupply() { return this.svc.getSkillsSupply(); }

  /* ═══ Step 6: CSV Exports ═══ */
  @Get('export/vendors')
  async exportVendors(@Res() res: Response) {
    const csv = await this.svc.exportVendorsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=vendors.csv');
    res.send(csv);
  }

  @Get('export/consultants')
  async exportConsultants(@Res() res: Response) {
    const csv = await this.svc.exportConsultantsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=consultants.csv');
    res.send(csv);
  }

  @Get('export/clients')
  async exportClients(@Res() res: Response) {
    const csv = await this.svc.exportClientsCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=clients.csv');
    res.send(csv);
  }

  @Get('export/reqs')
  async exportReqs(@Res() res: Response, @Query('empType') empType?: string) {
    const csv = await this.svc.exportReqsCsv(empType);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=req-signals.csv');
    res.send(csv);
  }

  @Get('export/contacts/:type')
  async exportContacts(@Res() res: Response, @Param('type') type: 'vendor' | 'client') {
    const csv = await this.svc.exportContactsCsv(type);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-contacts.csv`);
    res.send(csv);
  }

  @Get('mailboxes')
  getMailboxes() { return this.svc.getMailboxes(); }

  @Post('mailboxes')
  addMailbox(@Body() body: { email: string }) { return this.svc.addMailbox(body.email); }
}
