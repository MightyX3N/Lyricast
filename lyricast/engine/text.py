"""Lyrics text -> the character tokens the aligner understands.

The MMS forced-alignment model only knows lowercase a-z and the apostrophe, so
everything is romanised (unidecode) and numbers are spelled out. Words in
(parentheses) are treated as ad-libs: they are shown on screen but not forced
into the vocals, because backing vocals are often missing from the vocal stem
or sung over the lead.
"""
import re

try:
    from unidecode import unidecode
except Exception:  # pragma: no cover - unidecode is in requirements
    def unidecode(s):
        return s

ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def number_words(n: int) -> str:
    if n < 20:
        return ONES[n]
    if n < 100:
        return TENS[n // 10] + ("" if n % 10 == 0 else ONES[n % 10])
    if n < 1000:
        return ONES[n // 100] + "hundred" + ("" if n % 100 == 0 else number_words(n % 100))
    if 1100 <= n < 2100 and n % 100:          # years: 1999 -> nineteen ninety nine
        return number_words(n // 100) + number_words(n % 100)
    if n < 10000:
        return ONES[n // 1000] + "thousand" + ("" if n % 1000 == 0 else number_words(n % 1000))
    return "".join(ONES[int(d)] for d in str(n))


def spoken(word: str) -> str:
    """Romanised, lowercase, a-z and ' only. Empty when nothing is pronounceable."""
    w = unidecode(word.replace("’", "'").replace("‘", "'"))
    w = w.replace("&", "and").replace("%", "percent").replace("@", "at").replace("+", "plus")
    w = re.sub(r"\d+", lambda m: number_words(int(m.group())), w)
    w = w.lower()
    w = re.sub(r"[^a-z']", "", w)
    return w.strip("'")


def split_line(text: str):
    """-> list of dicts {text, chars, adlib} for one lyric line (display words kept as typed)."""
    out = []
    depth = 0
    for raw in re.findall(r"\S+", text.replace("\n", " ")):
        opens, closes = raw.count("("), raw.count(")")
        adlib = depth > 0 or opens > 0
        depth = max(0, depth + opens - closes)
        out.append({"text": raw, "chars": spoken(raw), "adlib": adlib})
    return out
