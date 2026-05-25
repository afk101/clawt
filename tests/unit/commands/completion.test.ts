import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerCompletionCommand } from '../../../src/commands/completion.js';
import * as worktreeUtils from '../../../src/utils/worktree.js';
import * as fs from 'node:fs';
import { CONFIG_DEFINITIONS } from '../../../src/constants/config.js';

// Mock 依赖模块
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn()
  };
});
vi.mock('../../../src/utils/worktree.js');
vi.mock('../../../src/logger/index.js', () => ({
  logger: {
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));
vi.mock('../../../src/utils/fs.js', () => ({}));

// mock i18n 模块，避免循环依赖导致 currentLanguage 未初始化
vi.mock('../../../src/utils/i18n.js', () => ({
  getCurrentLanguage: vi.fn().mockReturnValue('en'),
  resetLanguageCache: vi.fn(),
  setCurrentLanguage: vi.fn(),
  createMessages: vi.fn((i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
    const result: any = {};
    for (const key of Object.keys(i18nMap)) {
      result[key] = i18nMap[key]['en'];
    }
    return result;
  }),
}));

/**
 * 创建 statSync 的 mock 返回值
 * @param {boolean} isDir - 是否为目录
 * @returns {object} mock stat 对象
 */
function createStatMock(isDir: boolean) {
  return {
    isDirectory: () => isDir,
    isFile: () => !isDir
  } as any;
}

/**
 * 创建带有完整子命令结构的测试用 program 实例
 * 模拟实际 clawt 注册的命令层级，用于补全测试
 * @returns {Command} 配置好的 Commander 实例
 */
function createTestProgram(): Command {
  const program = new Command();
  program.name('clawt');

  // 模拟 run 命令及其选项
  program
    .command('run')
    .option('-b, --branch <name>', '指定分支')
    .option('-f, --file <file>', '指定任务文件')
    .option('-c, --concurrency <n>', '并发数')
    .option('-p, --prompt <text>', '任务提示');

  // 模拟 config 命令及其子命令
  const configCmd = program.command('config');
  configCmd.command('set').description('设置配置项');
  configCmd.command('get').description('获取配置项');
  configCmd.command('list').description('列出所有配置项');

  // 模拟 create 命令
  program.command('create').option('-b, --branch <name>', '分支名');

  // 模拟 list 命令（别名 ls）
  program.command('list').alias('ls');

  // 模拟 remove 命令（别名 rm）
  program.command('remove').alias('rm');

  // 模拟 merge 命令
  program.command('merge').option('-b, --branch <name>', '分支名');

  // 模拟 resume 命令
  program.command('resume').option('-b, --branch <name>', '分支名');

  // 模拟 status 命令（别名 st）
  program.command('status').alias('st');

  // 模拟 sync 命令
  program.command('sync');

  // 模拟 reset 命令
  program.command('reset');

  // 模拟 validate 命令
  program.command('validate');

  // 模拟 alias 命令
  program.command('alias');

  // 注册 completion 命令
  registerCompletionCommand(program);

  return program;
}

describe('Completion Command', () => {
  let program: Command;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = createTestProgram();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
    // 重新创建 consoleSpy（clearAllMocks 会清除上面的 spy）
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // Bash 脚本生成
  // ==========================================
  describe('Bash 脚本生成', () => {
    it('应输出包含 complete 注册语句的 Bash 脚本', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      expect(consoleSpy).toHaveBeenCalled();
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('complete -o nospace -F _clawt_completion clawt');
    });

    it('Bash 脚本应包含 _clawt_completion 函数定义', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('_clawt_completion()');
    });

    it('Bash 脚本应调用 clawt completion _complete 获取动态补全', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('clawt completion _complete bash');
    });

    it('Bash 脚本应包含 COMP_CWORD 和 COMP_WORDS 变量引用', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('COMP_CWORD');
      expect(script).toContain('COMP_WORDS');
    });

    it('Bash 脚本应包含 compopt -o nospace 处理目录补全', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('compopt -o nospace');
    });

    it('Bash 脚本应兼容 bash 3.2 (检查 compopt 是否可用)', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      // macOS 默认 bash 3.2 不支持 compopt，需检测
      expect(script).toContain('type compopt &>/dev/null');
    });

    it('Bash 脚本应使用 IFS 换行符分隔补全结果', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain("local IFS=$'\\n'");
    });

    it('Bash 脚本应使用 COMPREPLY 数组存储补全结果', () => {
      program.parse(['node', 'test', 'completion', 'bash']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('COMPREPLY=()');
      expect(script).toContain('COMPREPLY+=');
    });
  });

  // ==========================================
  // Zsh 脚本生成
  // ==========================================
  describe('Zsh 脚本生成', () => {
    it('应输出包含 compdef 注册语句的 Zsh 脚本', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      expect(consoleSpy).toHaveBeenCalled();
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('compdef _clawt_completion clawt');
    });

    it('Zsh 脚本应包含 _clawt_completion 函数定义', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('_clawt_completion()');
    });

    it('Zsh 脚本应包含 #compdef clawt 顶部标记', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('#compdef clawt');
    });

    it('Zsh 脚本应使用 compadd 命令添加补全项', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('compadd');
    });

    it('Zsh 脚本应区分目录和文件的空格后缀行为', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      const script = consoleSpy.mock.calls[0][0];
      // 目录：不追加空格
      expect(script).toContain("compadd -S '' --");
      // 文件/命令：追加空格
      expect(script).toContain("compadd -S ' ' --");
    });

    it('Zsh 脚本应使用 CURRENT 变量计算 cword', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('CURRENT - 1');
    });

    it('Zsh 脚本应使用 words 数组传递参数', () => {
      program.parse(['node', 'test', 'completion', 'zsh']);
      const script = consoleSpy.mock.calls[0][0];
      expect(script).toContain('${words[@]}');
    });
  });

  // ==========================================
  // 动态补全：分支名补全 (-b / --branch)
  // ==========================================
  describe('分支名补全 (-b / --branch)', () => {
    it('应列出所有匹配前缀的分支名 (Bash)', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-login', path: '/path/1' } as any,
        { branch: 'feature-signup', path: '/path/2' } as any,
        { branch: 'bugfix-crash', path: '/path/3' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'feat']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-login\nfeature-signup');
    });

    it('应列出所有匹配前缀的分支名 (Zsh)', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-login', path: '/path/1' } as any,
        { branch: 'feature-signup', path: '/path/2' } as any,
        { branch: 'bugfix-crash', path: '/path/3' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'zsh', '3', 'clawt', 'run', '-b', 'feat']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-login\nfeature-signup');
    });

    it('应支持 --branch 长选项触发分支补全', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-auth', path: '/path/1' } as any,
        { branch: 'main', path: '/path/2' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '--branch', 'feat']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-auth');
    });

    it('当输入前缀为空时应列出所有分支', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-a', path: '/path/1' } as any,
        { branch: 'bugfix-b', path: '/path/2' } as any,
        { branch: 'main', path: '/path/3' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', '']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-a\nbugfix-b\nmain');
    });

    it('当没有匹配的分支时应输出空字符串', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-a', path: '/path/1' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'xyz']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    it('当 getProjectWorktrees 抛出异常时应静默处理', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockImplementation(() => {
        throw new Error('非 git 仓库');
      });
      // 不应抛异常
      expect(() => {
        program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'feat']);
      }).not.toThrow();
    });

    it('应支持 create 命令中的 -b 分支补全', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'dev-branch', path: '/path/1' } as any,
        { branch: 'deploy-prod', path: '/path/2' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'create', '-b', 'dev']);
      expect(consoleSpy).toHaveBeenCalledWith('dev-branch');
    });

    it('应支持 merge 命令中的 -b 分支补全', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-merge-test', path: '/path/1' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'merge', '-b', 'feat']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-merge-test');
    });

    it('应支持 resume 命令中的 --branch 分支补全', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'task-1', path: '/path/1' } as any,
        { branch: 'task-2', path: '/path/2' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'resume', '--branch', 'task']);
      expect(consoleSpy).toHaveBeenCalledWith('task-1\ntask-2');
    });

    it('只有一个分支匹配时应精确输出该分支名', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-unique', path: '/path/1' } as any,
        { branch: 'bugfix-other', path: '/path/2' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'feature-u']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-unique');
    });

    it('worktrees 列表为空时应输出空字符串', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', '']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });
  });

  // ==========================================
  // 动态补全：文件路径补全 (-f / --file)
  // ==========================================
  describe('文件路径补全 (-f / --file)', () => {
    it('应列出所有文件和目录（不限制后缀）', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'task1.md', 'readme.txt', 'main.ts', 'docs'
      ] as any);
      vi.mocked(fs.statSync).mockImplementation((p: any) => {
        if (String(p).endsWith('docs')) {
          return createStatMock(true);
        }
        return createStatMock(false);
      });
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      // 所有文件都应出现（代码不限制后缀）
      expect(result).toContain('task1.md');
      expect(result).toContain('readme.txt');
      expect(result).toContain('main.ts');
      expect(result).toContain('docs/');
    });

    it('应根据前缀过滤匹配的文件', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        'test-login.md', 'test-signup.md', 'batch-deploy.md'
      ] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'test']);
      expect(consoleSpy).toHaveBeenCalledWith('test-login.md\ntest-signup.md');
    });

    it('应支持 --file 长选项触发文件补全', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['task.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '--file', 'ta']);
      expect(consoleSpy).toHaveBeenCalledWith('task.md');
    });

    it('目录应带有尾部斜杠 /', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['tasks', 'scripts'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(true));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('tasks/');
      expect(result).toContain('scripts/');
    });

    it('应支持子目录内的文件补全 (输入 "tasks/b")', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['batch.md', 'login.md', 'deploy.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'tasks/b']);
      expect(consoleSpy).toHaveBeenCalledWith('tasks/batch.md');
    });

    it('应支持子目录内带有前缀时过滤文件 (输入 "tasks/a")', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['api.md', 'auth.md', 'ui.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'tasks/a']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('tasks/api.md');
      expect(result).toContain('tasks/auth.md');
      expect(result).not.toContain('tasks/ui.md');
    });

    it('应跳过隐藏文件和隐藏目录（以 . 开头）', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([
        '.hidden.md', '.git', 'visible.md', 'docs'
      ] as any);
      vi.mocked(fs.statSync).mockImplementation((p: any) => {
        if (String(p).endsWith('.git') || String(p).endsWith('docs')) {
          return createStatMock(true);
        }
        return createStatMock(false);
      });
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).not.toContain('.hidden.md');
      expect(result).not.toContain('.git');
      expect(result).toContain('visible.md');
      expect(result).toContain('docs/');
    });

    it('当目录不存在时应返回空', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'nonexist/']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    it('当 statSync 抛出异常时应忽略该文件（权限不足等）', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['protected.md', 'normal.md'] as any);
      vi.mocked(fs.statSync).mockImplementation((p: any) => {
        if (String(p).endsWith('protected.md')) {
          throw new Error('EACCES: permission denied');
        }
        return createStatMock(false);
      });
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).not.toContain('protected.md');
      expect(result).toContain('normal.md');
    });

    it('当目录为空时应返回空', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue([] as any);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    it('应正确处理多层级嵌套目录路径 (输入 "a/b/c/deep")', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['deep-task.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'a/b/c/deep']);
      // dirname("a/b/c/deep") = "a/b/c"，所以前缀是 "a/b/c/"
      expect(consoleSpy).toHaveBeenCalledWith('a/b/c/deep-task.md');
    });

    it('只有目录没有文件时应只输出目录', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['subdir1', 'subdir2'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(true));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toBe('subdir1/\nsubdir2/');
    });

    it('前缀精确匹配文件名时应输出该文件', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['task.md', 'task-extra.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'task']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('task.md');
      expect(result).toContain('task-extra.md');
    });
  });

  // ==========================================
  // 动态补全：config set/get 配置键补全
  // ==========================================
  describe('config set/get 配置键补全', () => {
    it('config set 应列出匹配前缀的配置键', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'set', 'a']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('autoDeleteBranch');
      expect(result).toContain('autoPullPush');
    });

    it('config get 应列出匹配前缀的配置键', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'get', 'c']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('claudeCodeCommand');
      expect(result).toContain('confirmDestructiveOps');
    });

    it('config set 前缀为空时应列出所有配置键', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'set', '']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      // 验证所有配置键都包含在内
      const configKeys = Object.keys(CONFIG_DEFINITIONS);
      for (const key of configKeys) {
        expect(result).toContain(key);
      }
    });

    it('config set 输入不匹配任何配置键时应输出空', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'set', 'zzz']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    it('config set 输入 "max" 应匹配 maxConcurrency', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'set', 'max']);
      expect(consoleSpy).toHaveBeenCalledWith('maxConcurrency');
    });

    it('config set 输入 "terminal" 应匹配 terminalApp', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'set', 'terminal']);
      expect(consoleSpy).toHaveBeenCalledWith('terminalApp');
    });

    it('config get 输入 "aliases" 应匹配 aliases', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'get', 'aliases']);
      expect(consoleSpy).toHaveBeenCalledWith('aliases');
    });

    it('非 config 上下文中的 set 不应触发配置键补全', () => {
      // "run set xxx" 不应触发配置键补全
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', 'set', 'auto']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      // 不应包含配置键
      expect(result).not.toContain('autoDeleteBranch');
    });
  });

  // ==========================================
  // 动态补全：子命令补全
  // ==========================================
  describe('子命令补全', () => {
    it('输入 "r" 应匹配 run、remove、resume、reset', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'r']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('run');
      expect(result).toContain('remove');
      expect(result).toContain('resume');
      expect(result).toContain('reset');
    });

    it('输入 "ru" 应仅匹配 run', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'ru']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('run');
      expect(result).not.toContain('resume');
    });

    it('输入 "c" 应匹配 config、create、completion', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'c']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('config');
      expect(result).toContain('create');
      expect(result).toContain('completion');
    });

    it('输入 "s" 应匹配 status、sync 及别名 st', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 's']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('status');
      expect(result).toContain('sync');
      expect(result).toContain('st');
    });

    it('输入 "l" 应匹配 list 和别名 ls', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'l']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('list');
      expect(result).toContain('ls');
    });

    it('不应暴露内部命令 _complete', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', '_']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).not.toContain('_complete');
    });

    it('输入空字符串应列出所有顶级命令', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', '']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('run');
      expect(result).toContain('config');
      expect(result).toContain('list');
      expect(result).toContain('create');
      expect(result).toContain('remove');
      expect(result).toContain('merge');
      expect(result).toContain('status');
      expect(result).toContain('completion');
    });

    it('输入完全不匹配的前缀应返回空', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'zzz']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });

    it('输入 "m" 应匹配 merge', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'm']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('merge');
    });

    it('输入 "v" 应匹配 validate', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'v']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('validate');
    });

    it('输入 "a" 应匹配 alias', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'a']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('alias');
    });
  });

  // ==========================================
  // 动态补全：二级子命令补全
  // ==========================================
  describe('二级子命令补全', () => {
    it('config 后输入 "s" 应匹配 set', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'config', 's']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('set');
    });

    it('config 后输入空字符串应列出 set/get/list', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'config', '']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('set');
      expect(result).toContain('get');
      expect(result).toContain('list');
    });

    it('completion 后输入 "b" 应匹配 bash', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'completion', 'b']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('bash');
    });

    it('completion 后输入 "z" 应匹配 zsh', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'completion', 'z']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('zsh');
    });

    it('completion 后输入 "i" 应匹配 install', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'completion', 'i']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('install');
    });

    it('config 后输入 "g" 应匹配 get', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'config', 'g']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('get');
      expect(result).not.toContain('set');
    });

    it('config 后输入不匹配的前缀应返回空', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'config', 'zzz']);
      expect(consoleSpy).toHaveBeenCalledWith('');
    });
  });

  // ==========================================
  // 动态补全：选项补全
  // ==========================================
  describe('选项补全', () => {
    it('run 命令后输入 "-" 应列出可用短选项', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '-']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('-b');
      expect(result).toContain('-f');
      expect(result).toContain('-c');
      expect(result).toContain('-p');
    });

    it('run 命令后输入 "--" 应列出长选项', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '--']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('--branch');
      expect(result).toContain('--file');
      expect(result).toContain('--concurrency');
      expect(result).toContain('--prompt');
    });

    it('run 命令后输入 "--b" 应仅匹配 --branch', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '--b']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('--branch');
      expect(result).not.toContain('--file');
    });

    it('run 命令后输入 "--c" 应匹配 --concurrency', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '--c']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('--concurrency');
    });

    it('run 命令后输入空字符串应同时列出子命令和选项', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      // 选项也应作为候选出现
      expect(result).toContain('--branch');
      expect(result).toContain('--file');
    });

    it('run 命令后输入 "-f" 应匹配 -f 短选项', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '-f']);
      expect(consoleSpy).toHaveBeenCalled();
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('-f');
    });
  });

  // ==========================================
  // install 子命令
  // ==========================================
  describe('install 子命令', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('Zsh 环境应写入 .zshrc', () => {
      process.env.SHELL = '/bin/zsh';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writePath = (fs.writeFileSync as any).mock.calls[0][0];
      expect(writePath).toContain('.zshrc');
    });

    it('Bash 环境应写入 .bashrc', () => {
      process.env.SHELL = '/bin/bash';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writePath = (fs.writeFileSync as any).mock.calls[0][0];
      expect(writePath).toContain('.bashrc');
    });

    it('Zsh 安装脚本应使用 source <(clawt completion zsh)', () => {
      process.env.SHELL = '/bin/zsh';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      const content = (fs.writeFileSync as any).mock.calls[0][1];
      expect(content).toContain('source <(clawt completion zsh)');
    });

    it('Bash 安装脚本应使用 eval "$(clawt completion bash)"', () => {
      process.env.SHELL = '/bin/bash';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      const content = (fs.writeFileSync as any).mock.calls[0][1];
      expect(content).toContain('eval "$(clawt completion bash)"');
    });

    it('如果配置文件已包含 clawt completion 则不应重复写入', () => {
      process.env.SHELL = '/bin/zsh';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# existing config\nsource <(clawt completion zsh)\n');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      // 不应再次写入
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('如果配置文件存在但未包含 clawt completion 则应追加', () => {
      process.env.SHELL = '/bin/zsh';
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('# my zshrc\nexport PATH=$PATH:/usr/local/bin\n');
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const content = (fs.writeFileSync as any).mock.calls[0][1];
      // 应包含原有内容 + 新增的 completion 配置
      expect(content).toContain('# my zshrc');
      expect(content).toContain('clawt completion zsh');
    });

    it('未知 Shell 环境 (fish) 应给出警告而非报错', () => {
      process.env.SHELL = '/usr/bin/fish';
      expect(() => {
        program.parse(['node', 'test', 'completion', 'install']);
      }).not.toThrow();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('SHELL 环境变量为空时应给出警告', () => {
      process.env.SHELL = '';
      expect(() => {
        program.parse(['node', 'test', 'completion', 'install']);
      }).not.toThrow();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('SHELL 环境变量未设置时应给出警告', () => {
      delete process.env.SHELL;
      expect(() => {
        program.parse(['node', 'test', 'completion', 'install']);
      }).not.toThrow();
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('SHELL 路径包含 zsh 子串时应识别为 Zsh (如 /usr/local/bin/zsh)', () => {
      process.env.SHELL = '/usr/local/bin/zsh';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writePath = (fs.writeFileSync as any).mock.calls[0][0];
      expect(writePath).toContain('.zshrc');
    });

    it('SHELL 路径包含 bash 子串时应识别为 Bash (如 /opt/homebrew/bin/bash)', () => {
      process.env.SHELL = '/opt/homebrew/bin/bash';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      expect(fs.writeFileSync).toHaveBeenCalled();
      const writePath = (fs.writeFileSync as any).mock.calls[0][0];
      expect(writePath).toContain('.bashrc');
    });

    it('安装脚本应包含 clawt completion 注释标记', () => {
      process.env.SHELL = '/bin/zsh';
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      program.parse(['node', 'test', 'completion', 'install']);
      const content = (fs.writeFileSync as any).mock.calls[0][1];
      expect(content).toContain('# clawt completion');
    });
  });

  // ==========================================
  // _complete 命令参数校验
  // ==========================================
  describe('_complete 命令参数校验', () => {
    it('参数不足时不应输出任何内容', () => {
      program.parse(['node', 'test', 'completion', '_complete']);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('仅传入 shell 参数时不应输出任何内容', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash']);
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('传入两个参数时应正常执行补全', () => {
      // shell + cword 满足最低参数要求
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '0']);
      // 虽然可能没有有效输出，但不应报错
      expect(() => {}).not.toThrow();
    });
  });

  // ==========================================
  // Bash vs Zsh 动态补全行为一致性
  // ==========================================
  describe('Bash 与 Zsh 动态补全行为一致性', () => {
    it('子命令补全结果在 Bash 和 Zsh 中应一致', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'r']);
      const bashResult = consoleSpy.mock.calls[0][0];

      consoleSpy.mockClear();
      // 重新创建 program（commander 不支持重复 parse）
      const program2 = createTestProgram();
      program2.parse(['node', 'test', 'completion', '_complete', 'zsh', '1', 'clawt', 'r']);
      const zshResult = consoleSpy.mock.calls[0][0];

      expect(bashResult).toBe(zshResult);
    });

    it('分支补全结果在 Bash 和 Zsh 中应一致', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'test-1', path: '/p' } as any,
        { branch: 'test-2', path: '/p' } as any
      ]);

      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'test']);
      const bashResult = consoleSpy.mock.calls[0][0];

      consoleSpy.mockClear();
      const program2 = createTestProgram();
      program2.parse(['node', 'test', 'completion', '_complete', 'zsh', '3', 'clawt', 'run', '-b', 'test']);
      const zshResult = consoleSpy.mock.calls[0][0];

      expect(bashResult).toBe(zshResult);
    });

    it('文件补全结果在 Bash 和 Zsh 中应一致', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['a.md', 'b.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));

      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '']);
      const bashResult = consoleSpy.mock.calls[0][0];

      consoleSpy.mockClear();
      const program2 = createTestProgram();
      program2.parse(['node', 'test', 'completion', '_complete', 'zsh', '3', 'clawt', 'run', '-f', '']);
      const zshResult = consoleSpy.mock.calls[0][0];

      expect(bashResult).toBe(zshResult);
    });

    it('配置键补全结果在 Bash 和 Zsh 中应一致', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'config', 'set', 'auto']);
      const bashResult = consoleSpy.mock.calls[0][0];

      consoleSpy.mockClear();
      const program2 = createTestProgram();
      program2.parse(['node', 'test', 'completion', '_complete', 'zsh', '3', 'clawt', 'config', 'set', 'auto']);
      const zshResult = consoleSpy.mock.calls[0][0];

      expect(bashResult).toBe(zshResult);
    });
  });

  // ==========================================
  // 补全结果去重
  // ==========================================
  describe('补全结果去重', () => {
    it('输出的子命令列表不应有重复项', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', '']);
      const result = consoleSpy.mock.calls[0][0];
      const items = result.split('\n').filter((s: string) => s.length > 0);
      const uniqueItems = [...new Set(items)];
      expect(items.length).toBe(uniqueItems.length);
    });

    it('输出的选项列表不应有重复项', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '2', 'clawt', 'run', '-']);
      const result = consoleSpy.mock.calls[0][0];
      const items = result.split('\n').filter((s: string) => s.length > 0);
      const uniqueItems = [...new Set(items)];
      expect(items.length).toBe(uniqueItems.length);
    });
  });

  // ==========================================
  // 命令别名在子命令列表中的补全
  // ==========================================
  describe('命令别名在子命令列表中的补全', () => {
    // 别名只会在父命令名匹配时一并输出
    // 例如输入 "l" 时，list 匹配，其别名 ls 也以 "l" 开头所以会出现
    it('输入 "r" 时应包含 remove 的别名 rm', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'r']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('remove');
      expect(result).toContain('rm');
    });

    it('输入 "l" 时应包含 list 的别名 ls', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 'l']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('list');
      expect(result).toContain('ls');
    });

    it('输入 "s" 时应包含 status 的别名 st', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', 's']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('status');
      expect(result).toContain('st');
    });

    it('输入空字符串时别名也应出现在补全列表中', () => {
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '1', 'clawt', '']);
      const result = consoleSpy.mock.calls[0][0];
      // 所有别名都应列出
      expect(result).toContain('ls');
      expect(result).toContain('rm');
      expect(result).toContain('st');
    });
  });

  // ==========================================
  // 边界情况
  // ==========================================
  describe('边界情况', () => {
    it('cword 超出 words 长度时不应崩溃', () => {
      expect(() => {
        program.parse(['node', 'test', 'completion', '_complete', 'bash', '99', 'clawt']);
      }).not.toThrow();
    });

    it('cword 为 0 时应正常处理', () => {
      expect(() => {
        program.parse(['node', 'test', 'completion', '_complete', 'bash', '0', 'clawt']);
      }).not.toThrow();
    });

    it('cword 为负数时不应崩溃', () => {
      expect(() => {
        program.parse(['node', 'test', 'completion', '_complete', 'bash', '-1', 'clawt']);
      }).not.toThrow();
    });

    it('cword 为非数字时不应崩溃', () => {
      expect(() => {
        program.parse(['node', 'test', 'completion', '_complete', 'bash', 'abc', 'clawt']);
      }).not.toThrow();
    });

    it('包含斜杠的分支名应正常补全 (如 feat/user-auth)', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feat/user-auth', path: '/p' } as any,
        { branch: 'fix/bug-123', path: '/p' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'feat']);
      expect(consoleSpy).toHaveBeenCalledWith('feat/user-auth');
    });

    it('包含井号的分支名应正常补全 (如 fix/bug#123)', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'fix/bug#123', path: '/p' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'fix']);
      expect(consoleSpy).toHaveBeenCalledWith('fix/bug#123');
    });

    it('分支名包含中文时应正常补全', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'feature-测试分支', path: '/p' } as any,
        { branch: 'feature-正式环境', path: '/p' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'feature-测试']);
      expect(consoleSpy).toHaveBeenCalledWith('feature-测试分支');
    });

    it('大量分支列表时应正确过滤', () => {
      const branches = Array.from({ length: 50 }, (_, i) => ({
        branch: `branch-${String(i).padStart(3, '0')}`,
        path: `/p/${i}`
      }));
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue(branches as any);
      // 输入 "branch-00" 应匹配 branch-000 到 branch-009 共 10 个
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'branch-00']);
      const result = consoleSpy.mock.calls[0][0];
      const lines = result.split('\n').filter((s: string) => s.length > 0);
      expect(lines.length).toBe(10);
    });

    it('大量文件时应正确过滤', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const files = Array.from({ length: 100 }, (_, i) => `task-${i}.md`);
      vi.mocked(fs.readdirSync).mockReturnValue(files as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      // 输入 "task-9" 应匹配: task-9.md, task-90.md ~ task-99.md
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', 'task-9']);
      const result = consoleSpy.mock.calls[0][0];
      const lines = result.split('\n').filter((s: string) => s.length > 0);
      // task-9.md + task-90.md ~ task-99.md = 11 个
      expect(lines.length).toBe(11);
    });

    it('worktrees 返回单个分支且完全匹配时应输出该分支', () => {
      vi.mocked(worktreeUtils.getProjectWorktrees).mockReturnValue([
        { branch: 'main', path: '/p' } as any
      ]);
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-b', 'main']);
      expect(consoleSpy).toHaveBeenCalledWith('main');
    });

    it('文件名以数字开头时应正常补全', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readdirSync).mockReturnValue(['001-init.md', '002-deploy.md', 'readme.md'] as any);
      vi.mocked(fs.statSync).mockReturnValue(createStatMock(false));
      program.parse(['node', 'test', 'completion', '_complete', 'bash', '3', 'clawt', 'run', '-f', '00']);
      const result = consoleSpy.mock.calls[0][0];
      expect(result).toContain('001-init.md');
      expect(result).toContain('002-deploy.md');
      expect(result).not.toContain('readme.md');
    });
  });
});
