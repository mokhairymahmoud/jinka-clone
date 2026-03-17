import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { IsIn, IsOptional, IsString } from "class-validator";

import type { SearchSort } from "@jinka-eg/types";

import { ProjectsService } from "./projects.service.js";

class ProjectsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(["relevance", "newest", "price_asc", "price_desc"])
  sort?: SearchSort;
}

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projectsService: ProjectsService) {}

  @Get()
  getProjects(@Query() query: ProjectsQueryDto) {
    return this.projectsService.findAll(query.q, query.sort);
  }

  @Get(":id")
  getProject(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }
}
