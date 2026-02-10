import Enquirer from 'enquirer';

/**
 * 多行交互式输入框
 * 使用 enquirer 的 Input prompt（multiline 模式）实现
 * @param {string} message - 提示信息
 * @returns {Promise<string>} 用户输入的文本内容
 */
export async function multilineInput(message: string): Promise<string> {
  // @ts-expect-error enquirer 类型声明未导出 Input 类，但运行时存在
  const prompt = new Enquirer.Input({
    message,
    multiline: true,
  });

  const result: string = await prompt.run();
  return result;
}
