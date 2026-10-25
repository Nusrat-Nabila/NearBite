import re

BAD_WORDS = {
    "fuck", "fucks", "shit", "shits", "bitch", "bitches", "bastard", "bastards", "asshole", "assholes",
    "dick", "dickhead", "cunt", "whore", "slut", "pussy", "prick", "wanker", "twat", "bullshit", "dumbass",
    "jackass", "motherfucker", "retard", "nigger", "nigga",
    "chudi", "chudir", "chuda", "chudbo", "chudna", "magir", "maagi", "khanki", "khankir",
    "khankirpola", "harami", "haramjada", "haramzada", "haramir", "shuor", "shuorer", "shuar", "shuorer",
    "kutta", "kuttar", "kuttarbaccha", "bokachoda", "bokachodar", "bal", "baler", "gandu", "gaand",
    "madarchod", "behenchod", "bhosdi", "bhosdike", "bokacoda", "chodna", "chodon", "chod", "chodi",
    "beshya", "bessha", "magichoda",
    "চুদি", "চুদির", "চুদা", "চোদা", "চুদবো", "মাগি", "মাগী", "মাগির", "খানকি", "খানকির", "খানকিরপোলা",
    "হারামি", "হারামজাদা", "হারামজাদি", "বেশ্যা", "কুত্তা", "কুত্তার", "শুয়োর", "শুয়োরের", "বাল", "বালের",
    "গান্ডু", "বোকাচোদা", "বোকাচুদা", "মাগিচোদা",
}

BAD_STARTS = ("fuck", "shit", "bitch", "asshole", "bastard", "motherf", "cunt", "whore", "slut")

_LEET = str.maketrans({"@": "a", "$": "s", "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "!": "i"})
_TOKEN = re.compile(r"[A-Za-z0-9@$!*ঀ-৿]+")
_REPEAT = re.compile(r"(.)\1{2,}")


# Check one word against the bad words list.
def _is_bad(token):
    if token in BAD_WORDS or token.startswith(BAD_STARTS):
        return True
    if "*" in token and len(token.replace("*", "")) >= 2:
        for word in BAD_WORDS:
            if len(word) == len(token) and re.fullmatch(token.replace("*", "."), word):
                return True
        for start in BAD_STARTS:
            head = token[:len(start)]
            if len(head) == len(start) and re.fullmatch(head.replace("*", "."), start):
                return True
    return False


# Check if the text contains bad language, including disguised spellings.
def has_bad_language(text):
    if not text:
        return False
    for raw in _TOKEN.findall(str(text).lower()):
        for token in {raw, raw.translate(_LEET), _REPEAT.sub(r"\1", raw), _REPEAT.sub(r"\1", raw.translate(_LEET))}:
            if _is_bad(token.strip("*")):
                return True
    return False


# Email the customer that their review was removed.
def send_review_removed_email(customer, target, rating, comment):
    from account.views import send_status_mail

    if not customer.customer_email:
        return
    lines = [
        f"Hi {customer.customer_name},",
        "",
        f"Your review of {target} was removed because it did not follow the NearBite community guidelines.",
        "",
        f"Your review ({rating:g} {'star' if rating == 1 else 'stars'}):",
        f"\"{comment}\"" if comment else "(a rating without a comment)",
        "",
        "We want NearBite to be a respectful and helpful place for everyone, so please keep reviews honest, "
        "relevant and polite.",
        "",
        "The NearBite Team",
    ]
    send_status_mail("Your NearBite review was removed", "\n".join(lines), customer.customer_email)
