from __future__ import annotations

import csv
import shutil
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[1]
CSV_PATH = PROJECT_DIR / "data" / "quotes_clean.csv"
BACKUP_PATH = PROJECT_DIR / "data" / "quotes_clean_before_final_text_fixes.csv"


TEXT_FIXES_BY_ID = {
    "jan-19": "Football is a chess game to me. If you move your pawn against my bishop, I'll counter that move to beat you. Football is the same way. I study so much film that I know exactly what teams are going to do. I love knowing what an offense is going to run and stuffing that play.",
    "feb-18": "The only groups organized team activities really help are the quarterback and the receivers getting their timing and routes in rhythm.",
    "feb-19": "It is best to weigh the enemy more mighty than he seems.",
    "apr-12": "Smart veterans stick around even when they no longer have what they used to have. Smart GMs don't let smart veterans out of the building.",
    "apr-16": "It's not about collecting talent, it's about building a team.",
    "may-06": "We run the 4-3, so we look for outside linebackers who can get to the sidelines quickly. But it's a numbers game, and they have to be big enough to deal with an occasional offensive lineman.",
    "may-16": "Fans don't want to believe what scouts say about running backs. They get hypnotized by statistics. There's no such thing as a Hall of Fame running back. Offensive linemen decide the greatness of the men who carry the ball.",
    "jul-07": "Fundamentals are getting worse in the college game. What's sexy right now is the innovator of something newfangled. Sound fundamentals aren't sexy.",
    "jul-09": "The fans seem to want more playoff teams so that ten-win teams are never excluded. But since we realigned, teams with less than ten wins are just about .500 in the playoffs. More playoff teams means more nine-win teams upsetting the best teams.",
    "jul-16": "The reason for football is not to be the best but to be the best team.",
    "aug-25": "What's fun about cover-3 is that I have the numbers to blitz from either side. The quarterback has to read the shift. We can go sky or cloud from either side. And if he tries to throw into the blitz, we have a linebacker moving in the right direction.",
    "sep-21": "We went to the 16-game schedule about 35 years ago. So there's a lot of data. Teams rebound quickly. If you went 4-12 or worse in a season, you gained an average of 3.2 wins the following year. This keeps fans in the game long-term.",
    "oct-02": "If your starting quarterback tries to go on a year-long tuxedo tour while producing a .617 OPS and playing shortstop with the range of a lightly-deceased three-toed sloth, the fans are going to start screaming for his rookie backup at every turn. Baseball is a funny game.",
    "nov-04": "If an agent comes to me, and all he can say is that his player started ten games last season, I don't have to look at the film to know what I'm going to see. Experience means a lot in this league, and when you're struggling to find a job it works against you.",
    "nov-06": "Oh, coach makes certain we know our Xs and Os before every game. The problem was that I Xed while he Oed.",
    "nov-17": "Having a good quarterback is easily worth 15-20% of your salary cap. At least half of that is guaranteed money. It's not a stretch to say that a GM who makes a bad quarterback decision will soon be unemployed.",
    "nov-22": "Every once in a while you're tempted to remind a player what it means to put on that jersey. But this is pro ball, and he gets paid to wear it. If he doesn't hear 60,000 fans and he doesn't see their home town in block capitals on his shirt, the time for reminding him has long passed.",
    "nov-30": "Failure is part of success, an integral part. Everybody gets knocked down. Knowing it will happen and what you must do when it does is the first step back.",
    "dec-01": "When you have a 16-game season, everyone's banged up. Durability isn't about never missing a play, it's knowing how to play when you're hurting.",
    "nov-14": "Ambition is easy. What makes players great is succeeding in the face of others' ambitions.",
}


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"Could not find {CSV_PATH}")

    shutil.copy2(CSV_PATH, BACKUP_PATH)
    print(f"Backup created: {BACKUP_PATH}")

    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = reader.fieldnames

    if not fieldnames:
        raise ValueError("CSV has no header row.")

    changed = 0

    for row in rows:
        quote_id = row.get("id", "")
        if quote_id in TEXT_FIXES_BY_ID:
            old_text = row.get("cleaned_text", "")
            new_text = TEXT_FIXES_BY_ID[quote_id]

            if old_text != new_text:
                row["cleaned_text"] = new_text
                changed += 1
                print(f"\nUpdated {quote_id}")
                print(f"OLD: {old_text}")
                print(f"NEW: {new_text}")

    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"\nDone. Rows changed: {changed}")
    print(f"Updated CSV: {CSV_PATH}")


if __name__ == "__main__":
    main()
