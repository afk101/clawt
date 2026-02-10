/** Claude Code CLI 输出的 JSON 结果 */
export interface ClaudeCodeResult {
  type: string;
  subtype: string;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  stop_reason: string;
  session_id: string;
  total_cost_usd: number;
  usage: Record<string, unknown>;
}
