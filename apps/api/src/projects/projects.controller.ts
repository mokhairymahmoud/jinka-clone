import { Controller, Get, NotFoundException, Param } from "@nestjs/common";

import { AppStoreService } from "../common/app-store.service.js";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly store: AppStoreService) {}

  @Get()
  getProjects() {
    return this.store.getProjects();
  }

  @Get(":id")
  getProject(@Param("id") id: string) {
    const project = this.store.getProjectById(id);
    if (!project) throw new NotFoundException("Project not found");
    return project;
  }
}
