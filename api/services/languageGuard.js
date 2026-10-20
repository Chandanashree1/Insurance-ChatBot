/*
=========================================================
LANGUAGE GUARD
=========================================================

The bot supports exactly two languages: English and Arabic,
chosen by the language tab. Qwen models occasionally answer in
another language (Russian, Chinese, ...) when the customer's
message is very short, such as "hi", no matter what the prompt
says.

A prompt can't guarantee the language, but the writing system of
a reply can be checked in code. Chinese or Cyrillic characters
cannot appear in an English reply by accident.
=========================================================
*/

// Cyrillic, Devanagari, Thai, Hiragana/Katakana, CJK (incl. ext. A),
// Hangul - none of these belong in an English or Arabic reply.
const FOREIGN_SCRIPT =
    /[\u0400-\u04FF\u0900-\u097F\u0E00-\u0E7F\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF]/;

const ARABIC_LETTER = /[\u0600-\u06FF]/g;
const LATIN_LETTER = /[A-Za-z]/g;

function countMatches(text, regex) {
    const m = String(text).match(regex);
    return m ? m.length : 0;
}


/*
 * Returns true when `text` is not written in the expected language.
 *
 *  en: any foreign script, or more than a few Arabic letters.
 *  ar: any foreign script, or mostly Latin letters. Policy numbers,
 *      plate numbers and product names in English are allowed, so
 *      Arabic only has to be a clear majority of the letters.
 */
function isWrongLanguage(text, language) {

    const value = String(text || "");

    if (!value.trim()) {
        return false;
    }

    if (FOREIGN_SCRIPT.test(value)) {
        return true;
    }

    const arabic = countMatches(value, ARABIC_LETTER);
    const latin = countMatches(value, LATIN_LETTER);

    if (language === "ar") {

        // Too short to judge (e.g. "OK", a bare number).
        if (arabic + latin < 5) {
            return false;
        }

        return arabic / (arabic + latin) < 0.4;
    }

    return arabic > 5;
}


const LANGUAGE_NAME = {
    en: "English",
    ar: "Arabic"
};

function languageName(language) {
    return LANGUAGE_NAME[language] || LANGUAGE_NAME.en;
}


/*
 * Short reminder placed LAST in the prompt, where a small model
 * pays the most attention to it.
 */
function languageReminder(language) {

    const name = languageName(language);

    return (
        `Reply in ${name} only. Every word of your reply must be in ` +
        `${name}, even if the customer's message is very short or ` +
        `unclear. Never reply in Chinese, Russian or any other language.`
    );
}


const LANGUAGE_FALLBACK = {
    en: "Sorry, I couldn't phrase that properly. Could you please rephrase your question?",
    ar: "عذرًا، لم أتمكن من صياغة الرد بشكل صحيح. هل يمكنك إعادة صياغة سؤالك؟"
};

function languageFallback(language) {
    return LANGUAGE_FALLBACK[language] || LANGUAGE_FALLBACK.en;
}


module.exports = {
    isWrongLanguage,
    languageReminder,
    languageFallback
};