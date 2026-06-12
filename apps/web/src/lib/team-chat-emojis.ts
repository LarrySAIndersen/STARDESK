/** Curated emoji set for team chat (no external dependency). */

export const EMOJI_CATEGORIES: Readonly<
  Record<string, readonly string[]>
> = {
  "Ofte brugt": [
    "👍", "👎", "❤️", "😂", "🎉", "🔥", "👀", "✅", "❌", "💡",
    "🙏", "👏", "😊", "😢", "😮", "🤔", "💪", "⭐", "🚀", "📌",
  ],
  "Smileys": [
    "😀", "😃", "😄", "😁", "😆", "🥹", "😅", "🤣", "🙂", "😉",
    "😍", "🥰", "😘", "😋", "😎", "🤩", "🥳", "😇", "🤗", "🤭",
    "😤", "😱", "😭", "😡", "🤬", "😴", "🤢", "🤮", "🥶", "🤯",
  ],
  "Arbejde": [
    "💻", "🖥️", "📱", "⌨️", "🖱️", "📧", "📅", "📎", "📁", "📊",
    "📈", "📉", "🔧", "🔨", "⚙️", "🛠️", "🔒", "🔑", "🏢", "📞",
  ],
  "Sager": [
    "🎫", "📋", "📝", "✏️", "🔍", "🆘", "⚠️", "🚨", "⏰", "⏳",
    "🏁", "🎯", "💬", "📣", "🔔", "🛎️", "☎️", "📩", "📬", "🗂️",
  ],
  "Nature": [
    "☀️", "🌤️", "⛅", "🌧️", "❄️", "🌈", "🌸", "🌻", "🍀", "🌊",
  ],
  "Mad": [
    "☕", "🍵", "🥤", "🍕", "🍔", "🥪", "🍎", "🍰", "🍫", "🍪",
  ],
};

export const ALL_EMOJIS: readonly string[] = Object.values(EMOJI_CATEGORIES).flat();

export function filterEmojis(query: string): readonly string[] {
  const q = query.trim();
  if (!q) return ALL_EMOJIS;
  return ALL_EMOJIS;
}
