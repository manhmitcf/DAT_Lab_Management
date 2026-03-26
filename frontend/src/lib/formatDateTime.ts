/** Vietnam local time (UTC+7) — for UI overlays (e.g. live video timestamp). */
const TZ_VN = 'Asia/Ho_Chi_Minh';

const vnDateTimeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ_VN,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: false,
});

/**
 * `YYYY-MM-DD HH:mm:ss.sss` in Vietnam timezone (same visual style as former ISO slice, but +7).
 */
export function formatVietnamDateTime(date: Date = new Date()): string {
    return vnDateTimeFormatter.format(date).replace(', ', ' ');
}
