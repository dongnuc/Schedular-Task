# Schedular

Website lập kế hoạch công việc theo giờ / ngày / tuần / tháng, đo tiến độ và tỷ lệ hoàn thành,
hỗ trợ công việc lặp lại và nhắc việc qua Telegram (trước 30 phút + đúng giờ bắt đầu).

- **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS 4 → deploy Vercel
- **Database / Auth:** Supabase (Postgres + RLS + Auth email/mật khẩu)
- **Thông báo:** `pg_cron` (mỗi phút) → hàm SQL → `pg_net` → Telegram Bot API. Không cần server riêng.

## Kiến trúc dữ liệu

| Bảng | Vai trò |
| --- | --- |
| `profiles` | Cấu hình mỗi user: `telegram_chat_id`, `timezone`, `notify_enabled` |
| `tasks` | Định nghĩa công việc: ngày, giờ bắt đầu/kết thúc, quy tắc lặp (`none/daily/weekly/monthly`, chu kỳ, thứ trong tuần, ngày kết thúc) |
| `task_occurrences` | Kết quả của công việc trong **một ngày cụ thể**: trạng thái, % tiến độ, ghi chú kết quả, đánh giá 1–5 sao |
| `notification_log` | Nhật ký đã gửi (`before` / `start`), unique để mỗi thông báo chỉ gửi 1 lần |

Công việc lặp lại **không** sinh sẵn bản ghi: lịch được tính từ quy tắc lặp
(`src/lib/recurrence.ts` ở client, `public.task_occurs_on` ở SQL — hai nơi phải khớp nhau);
`task_occurrences` chỉ được tạo khi bạn ghi nhận tiến độ/kết quả.

## Cài đặt

### 1. Biến môi trường

Sửa `.env.local`:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon / publishable key trong Supabase Dashboard → Project Settings → API Keys>
```

### 2. Đẩy migration lên Supabase

```bash
supabase login          # đăng nhập đúng tài khoản sở hữu project Supabase của bạn
npm run db:link         # chọn project, nhập database password khi được hỏi
npm run db:push         # áp dụng supabase/migrations/*.sql
```

Thay đổi schema về sau: `npm run db:new -- ten_migration` → sửa file SQL mới → `npm run db:push`.

### 3. Telegram

1. Chat với **@BotFather** → `/newbot` → nhận bot token.
2. Lưu token vào Supabase Vault (Dashboard → SQL Editor):
   ```sql
   select vault.create_secret('<BOT_TOKEN>', 'telegram_bot_token');
   ```
3. Mở chat với bot và bấm **Start**.
4. Lấy Chat ID (nhắn **@userinfobot**), vào trang **Cài đặt** của app → dán Chat ID → Lưu → **Gửi thử thông báo**.

### 4. Chạy local

```bash
npm install
npm run dev
```

### 5. Deploy Vercel

```bash
vercel
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel --prod
```

Sau khi có domain, thêm nó vào Supabase Dashboard → Authentication → URL Configuration (Site URL).

## Cách thông báo hoạt động

`cron` job `schedular-dispatch-notifications` chạy mỗi phút, gọi `public.dispatch_task_notifications()`:

- Tìm công việc có `start_time`, bật `notify`, diễn ra hôm nay/ngày mai (theo múi giờ của user), chưa `done`/`skipped`.
- Còn ≤ 30 phút tới giờ bắt đầu → gửi tin **"Sắp đến giờ"** (loại `before`).
- Đã tới giờ (trong vòng 10 phút) → gửi tin **"Đến giờ bắt đầu"** (loại `start`).
- Ghi `notification_log` trước khi gửi nên không bao giờ gửi trùng.

Kiểm tra khi cần debug:

```sql
select * from cron.job_run_details order by start_time desc limit 10;
select * from net._http_response order by created desc limit 10;
select * from public.notification_log order by sent_at desc limit 10;
```
