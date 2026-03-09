import { Controller, Get, Inject, Param, Query } from "@nestjs/common";

import { ProjectsService } from "./projects.service.js";

@Controller("projects")
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projectsService: ProjectsService) {}

  @Get()
  getProjects(@Query("q") q?: string) {
    return this.projectsService.findAll(q);
  }

  @Get(":id")
  getProject(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }
}
