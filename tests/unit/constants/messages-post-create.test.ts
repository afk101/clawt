import { describe, it, expect } from 'vitest';
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
