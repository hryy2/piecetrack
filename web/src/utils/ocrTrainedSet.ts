/**
 * Known trained character set for Chinese handwriting recognition model.
 * Base training dictionary specified in requirements:
 * 0-9 黑咖黄蓝混红灰绿紫白粉色 套方条个张 防潮垫尘罩狗 × + 号
 */
export const TRAINED_CHINESE_CHARS = new Set([
  ...'0123456789',
  ...'黑咖黄蓝混红灰绿紫白粉色',
  ...'套方条个张',
  ...'防潮垫尘罩狗',
  ...'×+号+-/()., ',
]);

/**
 * Checks a string for any Chinese characters that haven't been trained yet.
 * Returns an array of unlearned characters.
 * If ocrLanguage is 'en', returns an empty array (English is a closed Latin alphabet).
 */
export function findUntrainedChineseChars(text: string, ocrLanguage: 'en' | 'zh'): string[] {
  if (ocrLanguage !== 'zh' || !text) return [];

  const unlearned: string[] = [];
  for (const char of text) {
    // Check if the character is a CJK ideograph
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (!TRAINED_CHINESE_CHARS.has(char) && !unlearned.includes(char)) {
        unlearned.push(char);
      }
    }
  }
  return unlearned;
}
