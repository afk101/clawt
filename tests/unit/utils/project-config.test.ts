import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

// mock logger
vi.mock('../../../src/logger/index.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// mock errors
vi.mock('../../../src/errors/index.js', () => ({
  ClawtError: class ClawtError extends Error {
    exitCode: number;
    constructor(message: string, exitCode = 1) {
      super(message);
      this.exitCode = exitCode;
    }
  },
}));

// mock constants
vi.mock('../../../src/constants/index.js', () => ({
  PROJECTS_CONFIG_DIR: '/mock/.clawt/projects',
  MESSAGES: {
    PROJECT_NOT_INITIALIZED: '项目尚未初始化，请先执行 clawt init 设置主工作分支',
    PROJECT_CONFIG_MISSING_BRANCH: '项目配置缺少主工作分支信息，请重新执行 clawt init 设置主工作分支',
  },
}));

// mock git
vi.mock('../../../src/utils/git.js', () => ({
  getProjectName: vi.fn().mockReturnValue('test-project'),
}));

// mock fs utils
vi.mock('../../../src/utils/fs.js', () => ({
  ensureDir: vi.fn(),
}));

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  getProjectConfigPath,
  loadProjectConfig,
  saveProjectConfig,
  requireProjectConfig,
  getMainWorkBranch,
  getValidateRunCommand,
} from '../../../src/utils/project-config.js';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);

beforeEach(() => {
  mockedExistsSync.mockReset();
  mockedReadFileSync.mockReset();
  mockedWriteFileSync.mockReset();
});

describe('getProjectConfigPath', () => {
  it('返回正确的配置文件路径', () => {
    const path = getProjectConfigPath('my-project');
    // 路径格式：<PROJECTS_CONFIG_DIR>/<projectName>/config.json
    expect(path).toContain('my-project');
    expect(path).toContain('config.json');
    expect(path).toContain('projects');
  });
});

describe('loadProjectConfig', () => {
  it('配置文件不存在时返回 null', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(loadProjectConfig()).toBeNull();
  });

  it('配置文件存在时正确解析', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ clawtMainWorkBranch: 'develop' }));
    const config = loadProjectConfig();
    expect(config).toEqual({ clawtMainWorkBranch: 'develop' });
  });

  it('配置文件损坏时返回 null', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue('invalid json');
    expect(loadProjectConfig()).toBeNull();
  });
});

describe('saveProjectConfig', () => {
  it('将配置写入文件', () => {
    saveProjectConfig({ clawtMainWorkBranch: 'main' });
    expect(mockedWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      JSON.stringify({ clawtMainWorkBranch: 'main' }, null, 2),
      'utf-8',
    );
  });
});

describe('requireProjectConfig', () => {
  it('配置存在且包含 clawtMainWorkBranch 时返回配置', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ clawtMainWorkBranch: 'main' }));
    expect(requireProjectConfig()).toEqual({ clawtMainWorkBranch: 'main' });
  });

  it('配置不存在时抛出错误', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(() => requireProjectConfig()).toThrow();
  });

  it('配置存在但缺少 clawtMainWorkBranch 字段时抛出错误', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({}));
    expect(() => requireProjectConfig()).toThrow('项目配置缺少主工作分支信息');
  });

  it('配置存在但 clawtMainWorkBranch 为空字符串时抛出错误', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ clawtMainWorkBranch: '' }));
    expect(() => requireProjectConfig()).toThrow('项目配置缺少主工作分支信息');
  });
});

describe('getMainWorkBranch', () => {
  it('返回主工作分支名', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ clawtMainWorkBranch: 'develop' }));
    expect(getMainWorkBranch()).toBe('develop');
  });
});

describe('getValidateRunCommand', () => {
  it('配置中有 validateRunCommand 时返回对应值', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      clawtMainWorkBranch: 'main',
      validateRunCommand: 'npm test',
    }));
    expect(getValidateRunCommand()).toBe('npm test');
  });

  it('配置中无 validateRunCommand 时返回 undefined', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({ clawtMainWorkBranch: 'main' }));
    expect(getValidateRunCommand()).toBeUndefined();
  });

  it('配置文件不存在时返回 undefined', () => {
    mockedExistsSync.mockReturnValue(false);
    expect(getValidateRunCommand()).toBeUndefined();
  });

  it('validateRunCommand 为空字符串时返回 undefined', () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(JSON.stringify({
      clawtMainWorkBranch: 'main',
      validateRunCommand: '',
    }));
    expect(getValidateRunCommand()).toBeUndefined();
  });
});
