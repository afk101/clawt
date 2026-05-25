import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from 'commander';
import chalk from 'chalk';
import { MESSAGES, WORKTREES_DIR } from '../constants/index.js';
import { logger } from '../logger/index.js';
import type {
  ProjectsOptions,
  ProjectOverview,
  ProjectWorktreeDetail,
  ProjectDetailResult,
  ProjectsOverviewResult,
} from '../types/index.js';
import {
  formatRelativeTime,
  formatDiskSize,
  formatLocalISOString,
  calculateDirSize,
  printInfo,
  printDoubleSeparator,
  printSeparator,
  printError,
} from '../utils/index.js';
import { getCurrentLanguage } from '../utils/i18n.js';

/**
 * 注册 projects 命令：统一管理多个项目的 worktree 状态
 * @param {Command} program - Commander 实例
 */
export function registerProjectsCommand(program: Command): void {
  program
    .command('projects [name]')
    .description(getCurrentLanguage() === 'en' ? 'Show worktree overview across projects, or view details for a specific project' : '展示所有项目的 worktree 概览，或查看指定项目的 worktree 详情')
    .option('--json', getCurrentLanguage() === 'en' ? 'Output in JSON format' : '以 JSON 格式输出')
    .action((name: string | undefined, options: { json?: boolean }) => {
      handleProjects({ name, json: options.json });
    });
}

/**
 * 执行 projects 命令的核心逻辑
 * @param {ProjectsOptions} options - 命令选项
 */
function handleProjects(options: ProjectsOptions): void {
  if (options.name) {
    handleProjectDetail(options.name, options.json);
  } else {
    handleProjectsOverview(options.json);
  }
}

/**
 * 处理项目概览展示：列出所有项目
 * @param {boolean} [json] - 是否以 JSON 格式输出
 */
function handleProjectsOverview(json?: boolean): void {
  const result = collectProjectsOverview();

  logger.info(`projects 命令执行，共 ${result.totalProjects} 个项目`);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printProjectsOverviewAsText(result);
}

/**
 * 处理指定项目的 worktree 详情展示
 * @param {string} name - 项目名
 * @param {boolean} [json] - 是否以 JSON 格式输出
 */
function handleProjectDetail(name: string, json?: boolean): void {
  const projectDir = join(WORKTREES_DIR, name);

  if (!existsSync(projectDir)) {
    printError(MESSAGES.PROJECTS_NOT_FOUND(name));
    process.exit(1);
  }

  const result = collectProjectDetail(name, projectDir);

  logger.info(`projects 命令执行，项目: ${name}，共 ${result.worktrees.length} 个 worktree`);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printProjectDetailAsText(result);
}

// ─── 数据收集函数 ─────────────────────────────────

/**
 * 收集所有项目的概览信息
 * @returns {ProjectsOverviewResult} 所有项目概览结果
 */
function collectProjectsOverview(): ProjectsOverviewResult {
  if (!existsSync(WORKTREES_DIR)) {
    return { projects: [], totalProjects: 0, totalDiskUsage: 0 };
  }

  const entries = readdirSync(WORKTREES_DIR, { withFileTypes: true });
  const projects: ProjectOverview[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const projectDir = join(WORKTREES_DIR, entry.name);
    const overview = collectSingleProjectOverview(entry.name, projectDir);
    projects.push(overview);
  }

  // 按最近活跃时间降序排序
  sortByLastActiveTimeDesc(projects);

  const totalDiskUsage = projects.reduce((sum, p) => sum + p.diskUsage, 0);

  return {
    projects,
    totalProjects: projects.length,
    totalDiskUsage,
  };
}

/**
 * 收集单个项目的概览信息
 * @param {string} name - 项目名
 * @param {string} projectDir - 项目目录路径
 * @returns {ProjectOverview} 项目概览
 */
function collectSingleProjectOverview(name: string, projectDir: string): ProjectOverview {
  const subEntries = readdirSync(projectDir, { withFileTypes: true });
  const worktreeDirs = subEntries.filter((e) => e.isDirectory());

  const worktreeCount = worktreeDirs.length;
  const diskUsage = calculateDirSize(projectDir);
  const lastActiveTime = resolveProjectLastActiveTime(projectDir, worktreeDirs.map((e) => join(projectDir, e.name)));

  return {
    name,
    worktreeCount,
    lastActiveTime,
    diskUsage,
  };
}

/**
 * 收集指定项目的 worktree 详情
 * @param {string} name - 项目名
 * @param {string} projectDir - 项目目录路径
 * @returns {ProjectDetailResult} 项目详情结果
 */
function collectProjectDetail(name: string, projectDir: string): ProjectDetailResult {
  const subEntries = readdirSync(projectDir, { withFileTypes: true });
  const worktrees: ProjectWorktreeDetail[] = [];

  for (const entry of subEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const wtPath = join(projectDir, entry.name);
    const detail = collectSingleWorktreeDetail(entry.name, wtPath);
    worktrees.push(detail);
  }

  // 按最近修改时间降序排序
  worktrees.sort((a, b) => new Date(b.lastModifiedTime).getTime() - new Date(a.lastModifiedTime).getTime());

  const totalDiskUsage = worktrees.reduce((sum, wt) => sum + wt.diskUsage, 0);

  return {
    name,
    projectDir,
    worktrees,
    totalDiskUsage,
  };
}

/**
 * 收集单个 worktree 的详情信息
 * @param {string} branch - 分支名（目录名即分支名）
 * @param {string} wtPath - worktree 路径
 * @returns {ProjectWorktreeDetail} worktree 详情
 */
function collectSingleWorktreeDetail(branch: string, wtPath: string): ProjectWorktreeDetail {
  const stat = statSync(wtPath);
  const diskUsage = calculateDirSize(wtPath);

  return {
    branch,
    path: wtPath,
    lastModifiedTime: formatLocalISOString(stat.mtime),
    diskUsage,
  };
}

// ─── 工具函数 ─────────────────────────────────────

/**
 * 确定项目的最近活跃时间
 * 取项目目录自身和所有子 worktree 目录修改时间的最大值
 * @param {string} projectDir - 项目目录路径
 * @param {string[]} worktreePaths - worktree 路径列表
 * @returns {string} ISO 8601 格式的最近活跃时间
 */
function resolveProjectLastActiveTime(projectDir: string, worktreePaths: string[]): string {
  let latestTime = statSync(projectDir).mtime;

  for (const wtPath of worktreePaths) {
    try {
      const wtStat = statSync(wtPath);
      if (wtStat.mtime > latestTime) {
        latestTime = wtStat.mtime;
      }
    } catch {
      // 忽略无法访问的目录
    }
  }

  return formatLocalISOString(latestTime);
}

/**
 * 按最近活跃时间降序排序项目概览列表（原地排序）
 * @param {ProjectOverview[]} projects - 项目概览列表
 */
function sortByLastActiveTimeDesc(projects: ProjectOverview[]): void {
  projects.sort((a, b) => new Date(b.lastActiveTime).getTime() - new Date(a.lastActiveTime).getTime());
}

// ─── 文本输出函数 ─────────────────────────────────

/**
 * 以文本格式输出所有项目概览
 * @param {ProjectsOverviewResult} result - 项目概览结果
 */
function printProjectsOverviewAsText(result: ProjectsOverviewResult): void {
  printDoubleSeparator();
  printInfo(`  ${chalk.bold.cyan(MESSAGES.PROJECTS_OVERVIEW_TITLE)}`);
  printDoubleSeparator();
  printInfo('');

  if (result.projects.length === 0) {
    printInfo(`  ${MESSAGES.PROJECTS_NO_PROJECTS}`);
    printInfo('');
    printDoubleSeparator();
    return;
  }

  for (const project of result.projects) {
    printProjectOverviewItem(project);
  }

  printSeparator();
  printInfo('');
  const lang = getCurrentLanguage();
  printInfo(`  ${chalk.bold(String(result.totalProjects))} ${lang === 'en' ? 'project(s)' : '个项目'}   ${chalk.gray(MESSAGES.PROJECTS_TOTAL_DISK_USAGE(formatDiskSize(result.totalDiskUsage)))}`);
  printInfo('');
  printDoubleSeparator();
}

/**
 * 输出单个项目概览项
 * @param {ProjectOverview} project - 项目概览
 */
function printProjectOverviewItem(project: ProjectOverview): void {
  const relativeTime = formatRelativeTime(project.lastActiveTime);
  const activeLabel = relativeTime ? MESSAGES.PROJECTS_LAST_ACTIVE(relativeTime) : '';
  const diskLabel = MESSAGES.PROJECTS_DISK_USAGE(formatDiskSize(project.diskUsage));

  printInfo(`  ${chalk.bold('●')} ${chalk.bold(project.name)}`);
  printInfo(`    ${MESSAGES.PROJECTS_WORKTREE_COUNT(project.worktreeCount)}   ${chalk.gray(activeLabel)}   ${chalk.gray(diskLabel)}`);
  printInfo('');
}

/**
 * 以文本格式输出指定项目的 worktree 详情
 * @param {ProjectDetailResult} result - 项目详情结果
 */
function printProjectDetailAsText(result: ProjectDetailResult): void {
  printDoubleSeparator();
  printInfo(`  ${chalk.bold.cyan(MESSAGES.PROJECTS_DETAIL_TITLE(result.name))}`);
  printDoubleSeparator();
  printInfo('');

  printInfo(`  ${chalk.bold('◆')} ${chalk.bold(MESSAGES.PROJECTS_PATH(result.projectDir))}`);
  printInfo(`    ${MESSAGES.PROJECTS_TOTAL_DISK_USAGE(formatDiskSize(result.totalDiskUsage))}`);
  printInfo('');

  printSeparator();
  printInfo('');

  if (result.worktrees.length === 0) {
    printInfo(`  ${MESSAGES.PROJECTS_DETAIL_NO_WORKTREES}`);
    printInfo('');
    printDoubleSeparator();
    return;
  }

  for (const wt of result.worktrees) {
    printWorktreeDetailItem(wt);
  }

  printDoubleSeparator();
}

/**
 * 输出单个 worktree 详情项
 * @param {ProjectWorktreeDetail} wt - worktree 详情
 */
function printWorktreeDetailItem(wt: ProjectWorktreeDetail): void {
  const relativeTime = formatRelativeTime(wt.lastModifiedTime);
  const modifiedLabel = relativeTime ? MESSAGES.PROJECTS_LAST_MODIFIED(relativeTime) : '';
  const diskLabel = MESSAGES.PROJECTS_DISK_USAGE(formatDiskSize(wt.diskUsage));

  printInfo(`  ${chalk.bold('●')} ${chalk.bold(wt.branch)}`);
  printInfo(`    ${wt.path}`);
  printInfo(`    ${chalk.gray(modifiedLabel)}   ${chalk.gray(diskLabel)}`);
  printInfo('');
}
