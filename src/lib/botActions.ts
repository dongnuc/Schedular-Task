/** Danh mục hành động có sẵn của bot. Phải khớp CHECK constraint của bot_commands.action và public.bot_execute. */
export type BotAction =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'next'
  | 'pending'
  | 'overdue'
  | 'done'
  | 'stats_week'
  | 'stats_month'
  | 'help'
  | 'text'

export interface BotActionDef {
  key: BotAction
  label: string
  /** Mô tả bot sẽ làm gì khi nhận lệnh. */
  description: string
  /** Gợi ý cách gõ. */
  usage?: string
}

export const BOT_ACTIONS: BotActionDef[] = [
  { key: 'today', label: 'Việc hôm nay', description: 'Liệt kê công việc hôm nay, đánh số thứ tự và trạng thái từng việc.' },
  { key: 'tomorrow', label: 'Việc ngày mai', description: 'Liệt kê công việc ngày mai.' },
  { key: 'week', label: 'Việc cả tuần', description: 'Tổng quan tuần này (T2–CN): tiến độ chung và việc theo từng ngày.' },
  { key: 'next', label: 'Việc tiếp theo', description: 'Việc có giờ bắt đầu gần nhất chưa làm, kèm số phút còn lại.' },
  { key: 'pending', label: 'Việc chưa xong', description: 'Các việc hôm nay còn đang chờ hoặc đang làm.' },
  { key: 'overdue', label: 'Việc quá hạn', description: 'Các việc đã quá hạn mà chưa xong trong 7 ngày gần đây.' },
  {
    key: 'done',
    label: 'Đánh dấu hoàn thành',
    description: 'Hoàn thành việc theo số thứ tự trong danh sách hôm nay (số lấy từ lệnh “Việc hôm nay”).',
    usage: '/done 2',
  },
  { key: 'stats_week', label: 'Thống kê tuần', description: 'Tỷ lệ hoàn thành, đang làm, quá hạn, bỏ qua của tuần này.' },
  { key: 'stats_month', label: 'Thống kê tháng', description: 'Như thống kê tuần nhưng cho tháng này.' },
  { key: 'help', label: 'Danh sách lệnh', description: 'Tự động liệt kê mọi lệnh đang bật cùng mô tả.' },
  { key: 'text', label: 'Trả lời văn bản', description: 'Trả lời một đoạn văn bản cố định do bạn viết (ghi chú, link nhanh…).' },
]

export const actionOf = (key: string) => BOT_ACTIONS.find((a) => a.key === key)

export interface BotCommand {
  id: string
  command: string
  description: string
  action: BotAction
  reply_text: string | null
  enabled: boolean
  sort_order: number
  updated_at: string
}

export interface BotSyncStatus {
  synced: boolean
  synced_at: string | null
}
