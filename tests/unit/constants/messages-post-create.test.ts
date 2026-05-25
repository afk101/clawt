import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock i18n 模块，使 getCurrentLanguage 返回 'zh-CN' 以匹配中文断言
vi.mock('../../../src/utils/i18n.js', () => ({
  getCurrentLanguage: vi.fn().mockReturnValue('zh-CN'),
  resetLanguageCache: vi.fn(),
  setCurrentLanguage: vi.fn(),
  createMessages: vi.fn((i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
    const result: any = {};
    for (const key of Object.keys(i18nMap)) {
      result[key] = i18nMap[key]['zh-CN'];
    }
    return result;
  }),
}));

import { POST_CREATE_MESSAGES } from '../../../src/constants/messages/post-create.js';

describe('POST_CREATE_MESSAGES', () => {
  describe('纯字符串消息', () => {
    it('HOOK_SKIPPED 包含 --no-post-create', () => {
      expect(POST_CREATE_MESSAGES.HOOK_SKIPPED).toContain('--no-post-create');
    });

    it('HOOK_SKIPPED 不包含旧的 --no-deps', () => {
      expect(POST_CREATE_MESSAGES.HOOK_SKIPPED).not.toContain('--no-deps');
    });

    it('HOOK_NOT_CONFIGURED 不包含"依赖"字样', () => {
      expect(POST_CREATE_MESSAGES.HOOK_NOT_CONFIGURED).not.toContain('依赖');
    });

    it('HOOK_NOT_CONFIGURED 包含"未配置"和"跳过"', () => {
      expect(POST_CREATE_MESSAGES.HOOK_NOT_CONFIGURED).toContain('未配置');
      expect(POST_CREATE_MESSAGES.HOOK_NOT_CONFIGURED).toContain('跳过');
    });
  });

  describe('模板函数消息', () => {
    it('HOOK_SOURCE_INFO 包含来源描述', () => {
      const result = POST_CREATE_MESSAGES.HOOK_SOURCE_INFO('项目配置 (postCreate)');
      expect(result).toContain('项目配置 (postCreate)');
      expect(result).toContain('postCreate hook 来源');
    });

    it('HOOK_EXECUTING 包含分支名和命令', () => {
      const result = POST_CREATE_MESSAGES.HOOK_EXECUTING('feat-login', 'npm install');
      expect(result).toContain('feat-login');
      expect(result).toContain('npm install');
    });

    it('HOOK_SUCCESS 包含分支名', () => {
      const result = POST_CREATE_MESSAGES.HOOK_SUCCESS('feat-login');
      expect(result).toContain('feat-login');
      expect(result).toContain('成功');
    });

    it('HOOK_FAILED 包含分支名和错误信息', () => {
      const result = POST_CREATE_MESSAGES.HOOK_FAILED('feat-login', '命令退出码: 1');
      expect(result).toContain('feat-login');
      expect(result).toContain('命令退出码: 1');
      expect(result).toContain('失败');
    });

    it('HOOK_SUMMARY 包含成功和失败计数', () => {
      const result = POST_CREATE_MESSAGES.HOOK_SUMMARY(3, 1);
      expect(result).toContain('3');
      expect(result).toContain('1');
      expect(result).toContain('成功');
      expect(result).toContain('失败');
    });

    it('HOOK_SUMMARY 全部成功时失败数为 0', () => {
      const result = POST_CREATE_MESSAGES.HOOK_SUMMARY(5, 0);
      expect(result).toContain('5 成功');
      expect(result).toContain('0 失败');
    });

    it('POST_CREATE_SCRIPT_NOT_EXECUTABLE 包含路径和手动 chmod 提示', () => {
      const result = POST_CREATE_MESSAGES.POST_CREATE_SCRIPT_NOT_EXECUTABLE('/repo/.clawt/postCreate.sh');
      expect(result).toContain('/repo/.clawt/postCreate.sh');
      expect(result).toContain('chmod +x');
      expect(result).toContain('不可执行');
    });

    it('POST_CREATE_SCRIPT_AUTO_CHMOD 包含路径和自动修复提示', () => {
      const result = POST_CREATE_MESSAGES.POST_CREATE_SCRIPT_AUTO_CHMOD('/repo/.clawt/postCreate.sh');
      expect(result).toContain('/repo/.clawt/postCreate.sh');
      expect(result).toContain('已自动添加执行权限');
    });

    it('HOOK_BACKGROUND_START 包含 worktree 数量和命令', () => {
      const result = POST_CREATE_MESSAGES.HOOK_BACKGROUND_START(3, 'npm install');
      expect(result).toContain('3');
      expect(result).toContain('npm install');
      expect(result).toContain('后台执行');
    });

    it('HOOK_BACKGROUND_START 单个 worktree 时正确显示', () => {
      const result = POST_CREATE_MESSAGES.HOOK_BACKGROUND_START(1, 'pnpm install');
      expect(result).toContain('1 个 worktree');
      expect(result).toContain('pnpm install');
    });
  });

  describe('语义修正验证', () => {
    it('不存在旧的 HOOK_SKIPPED_NO_DEPS 键', () => {
      expect('HOOK_SKIPPED_NO_DEPS' in POST_CREATE_MESSAGES).toBe(false);
    });

    it('不存在旧的 SETUP_SCRIPT_NOT_EXECUTABLE 键', () => {
      expect('SETUP_SCRIPT_NOT_EXECUTABLE' in POST_CREATE_MESSAGES).toBe(false);
    });

    it('存在新的 HOOK_SKIPPED 键', () => {
      expect('HOOK_SKIPPED' in POST_CREATE_MESSAGES).toBe(true);
    });

    it('存在新的 POST_CREATE_SCRIPT_NOT_EXECUTABLE 键', () => {
      expect('POST_CREATE_SCRIPT_NOT_EXECUTABLE' in POST_CREATE_MESSAGES).toBe(true);
    });

    it('存在新的 POST_CREATE_SCRIPT_AUTO_CHMOD 键', () => {
      expect('POST_CREATE_SCRIPT_AUTO_CHMOD' in POST_CREATE_MESSAGES).toBe(true);
    });
  });
});

/**
 * 英文版 post-create 消息测试
 * 使用 vi.resetModules + vi.doMock 动态切换语言为 en，
 * 然后重新加载 POST_CREATE_MESSAGES 模块验证英文版消息内容
 */
describe('POST_CREATE_MESSAGES — 英文版', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('纯字符串消息在英文版下返回英文文本', async () => {
    vi.doMock('../../../src/utils/i18n.js', () => ({
      getCurrentLanguage: () => 'en',
      resetLanguageCache: vi.fn(),
      setCurrentLanguage: vi.fn(),
      createMessages: (i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
        const result: any = {};
        for (const key of Object.keys(i18nMap)) {
          result[key] = i18nMap[key]['en'];
        }
        return result;
      },
    }));

    const { POST_CREATE_MESSAGES: EN_MSGS } = await import('../../../src/constants/messages/post-create.js');

    // HOOK_SKIPPED 英文版包含 Skipped
    expect(EN_MSGS.HOOK_SKIPPED).toContain('Skipped');

    // HOOK_NOT_CONFIGURED 英文版包含 "not configured" 和 "skipping"
    expect(EN_MSGS.HOOK_NOT_CONFIGURED).toContain('not configured');
    expect(EN_MSGS.HOOK_NOT_CONFIGURED).toContain('skipping');
  });

  it('模板函数消息在英文版下返回英文文本', async () => {
    vi.doMock('../../../src/utils/i18n.js', () => ({
      getCurrentLanguage: () => 'en',
      resetLanguageCache: vi.fn(),
      setCurrentLanguage: vi.fn(),
      createMessages: (i18nMap: Record<string, { en: any; 'zh-CN': any }>) => {
        const result: any = {};
        for (const key of Object.keys(i18nMap)) {
          result[key] = i18nMap[key]['en'];
        }
        return result;
      },
    }));

    const { POST_CREATE_MESSAGES: EN_MSGS } = await import('../../../src/constants/messages/post-create.js');

    // HOOK_SOURCE_INFO 英文版包含 "postCreate hook source"
    expect(EN_MSGS.HOOK_SOURCE_INFO('project config')).toContain('postCreate hook source');

    // HOOK_SUCCESS 英文版包含 "successfully" 而非 "成功"
    expect(EN_MSGS.HOOK_SUCCESS('feat-login')).toContain('successfully');
    expect(EN_MSGS.HOOK_SUCCESS('feat-login')).not.toContain('成功');

    // HOOK_FAILED 英文版包含 "failed" 而非 "失败"
    expect(EN_MSGS.HOOK_FAILED('feat-login', 'error')).toContain('failed');
    expect(EN_MSGS.HOOK_FAILED('feat-login', 'error')).not.toContain('失败');

    // HOOK_SUMMARY 英文版包含 "succeeded"/"failed" 而非 "成功"/"失败"
    const summary = EN_MSGS.HOOK_SUMMARY(5, 0);
    expect(summary).toContain('5 succeeded');
    expect(summary).toContain('0 failed');

    // POST_CREATE_SCRIPT_NOT_EXECUTABLE 英文版包含 "not executable"
    expect(EN_MSGS.POST_CREATE_SCRIPT_NOT_EXECUTABLE('/repo/.clawt/postCreate.sh')).toContain('not executable');

    // POST_CREATE_SCRIPT_AUTO_CHMOD 英文版包含 "auto-added execute permission"
    expect(EN_MSGS.POST_CREATE_SCRIPT_AUTO_CHMOD('/repo/.clawt/postCreate.sh')).toContain('auto-added execute permission');

    // HOOK_BACKGROUND_START 英文版包含 "running in background"
    expect(EN_MSGS.HOOK_BACKGROUND_START(3, 'npm install')).toContain('running in background');
  });
});
