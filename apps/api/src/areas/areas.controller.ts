import { Controller, Get, Inject, Query } from "@nestjs/common";
import { IsOptional, IsString } from "class-validator";

import { AreasService } from "./areas.service.js";

class AreasQueryDto {
  @IsOptional()
  @IsString()
  q?: string;
}

@Controller("areas")
export class AreasController {
  constructor(@Inject(AreasService) private readonly areasService: AreasService) {}

  @Get()
  getAreas(@Query() query: AreasQueryDto) {
    return this.areasService.findAreas(query.q);
  }
}
