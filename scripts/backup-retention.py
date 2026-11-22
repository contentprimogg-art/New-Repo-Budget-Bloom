"""Liste les sauvegardes à retirer (noms lus sur l'entrée standard, un par ligne).

On garde les 30 plus récentes, plus la plus ancienne de chacun des 12 derniers mois.
Seuls les fichiers au nom exact « budget-bloom-AAAA-MM-JJ.dump.age » sont pris en compte.
"""
import re
import sys

PATTERN = re.compile(r"^budget-bloom-(\d{4})-(\d{2})-(\d{2})\.dump\.age$")
KEEP_DAILY = 30
KEEP_MONTHS = 12


def to_remove(names):
    backups = sorted({n for n in names if PATTERN.match(n)}, reverse=True)
    keep = set(backups[:KEEP_DAILY])
    first_of_month = {}
    for name in backups:  # du plus récent au plus ancien: la dernière écriture est la plus ancienne du mois
        first_of_month[name[len("budget-bloom-"):len("budget-bloom-AAAA-MM")]] = name
    for month in sorted(first_of_month, reverse=True)[:KEEP_MONTHS]:
        keep.add(first_of_month[month])
    return [n for n in backups if n not in keep]


if __name__ == "__main__":
    for item in to_remove(line.strip() for line in sys.stdin):
        print(item)
