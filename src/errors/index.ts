import { EXIT_CODES } from '../constants/index.js';

/**
 * Clawt 自定义错误类
 * 携带退出码信息，用于统一错误处理
 */
export class ClawtError extends Error {
  /** 退出码 */
  public readonly exitCode: number;

  /**
   * @param {string} message - 错误消息
   * @param {number} exitCode - 退出码，默认为 EXIT_CODES.ERROR (1)
   */
  constructor(message: string, exitCode: number = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'ClawtError';
    this.exitCode = exitCode;
  }
}
