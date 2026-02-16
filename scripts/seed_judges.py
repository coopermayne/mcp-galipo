#!/usr/bin/env python3
"""
Seed judges for California federal district courts.

Scraped from official court websites (Feb 2026):
- https://apps.cacd.uscourts.gov/Jps/
- https://www.caed.uscourts.gov/caednew/index.cfm/judges/all-judges/
- https://www.cand.uscourts.gov/judges/
- https://www.casd.uscourts.gov/judges

Usage:
    set -a && source .env && set +a
    python scripts/seed_judges.py
"""

import os
import sys

from dotenv import load_dotenv
load_dotenv()

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.session import SessionLocal
from models import Jurisdiction, Judge
from sqlalchemy import select


# ── Jurisdiction short names (must match DEFAULT_JURISDICTIONS in validation.py)
CACD = "C.D. Cal."
CAED = "E.D. Cal."
CAND = "N.D. Cal."
CASD = "S.D. Cal."
CA9 = "9th Cir."


# ── Judge data by jurisdiction ──────────────────────────────────────────────
# Fields: name, title, initials, status (default Active)

JUDGES = {
    CACD: [
        # District Judges
        {"name": "Dolly M. Gee", "title": "Judge", "initials": "DMG", "notes": "Chief Judge"},
        {"name": "Fernando L. Aenlle-Rocha", "title": "Judge", "initials": "FLA"},
        {"name": "Percy Anderson", "title": "Judge", "initials": "PA"},
        {"name": "Jesus G. Bernal", "title": "Judge", "initials": "JGB"},
        {"name": "André Birotte Jr.", "title": "Judge", "initials": "AB"},
        {"name": "Stanley Blumenfeld Jr.", "title": "Judge", "initials": "SB"},
        {"name": "David O. Carter", "title": "Judge", "initials": "DOC"},
        {"name": "Michelle Williams Court", "title": "Judge", "initials": "MWC"},
        {"name": "Michael W. Fitzgerald", "title": "Judge", "initials": "MWF"},
        {"name": "Maame Ewusi-Mensah Frimpong", "title": "Judge", "initials": "MEMF"},
        {"name": "Sherilyn Peace Garnett", "title": "Judge", "initials": "SPG"},
        {"name": "John W. Holcomb", "title": "Judge", "initials": "JWH"},
        {"name": "Wesley L. Hsu", "title": "Judge", "initials": "WLH"},
        {"name": "Anne Hwang", "title": "Judge", "initials": "AH"},
        {"name": "Kenly Kiya Kato", "title": "Judge", "initials": "KK"},
        {"name": "R. Gary Klausner", "title": "Judge", "initials": "RGK"},
        {"name": "Serena R. Murillo", "title": "Judge", "initials": "SRM"},
        {"name": "Fernando M. Olguin", "title": "Judge", "initials": "FMO"},
        {"name": "Mónica Ramírez Almadani", "title": "Judge", "initials": "MRA"},
        {"name": "Mark C. Scarsi", "title": "Judge", "initials": "MCS"},
        {"name": "Fred W. Slaughter", "title": "Judge", "initials": "FWS"},
        {"name": "Josephine L. Staton", "title": "Judge", "initials": "JLS"},
        {"name": "Sunshine S. Sykes", "title": "Judge", "initials": "SSS"},
        {"name": "Cynthia Valenzuela", "title": "Judge", "initials": "CV"},
        {"name": "Hernán D. Vera", "title": "Judge", "initials": "HDV"},
        {"name": "John F. Walter", "title": "Judge", "initials": "JFW"},
        {"name": "Stephen V. Wilson", "title": "Judge", "initials": "SVW"},
        {"name": "Otis D. Wright II", "title": "Judge", "initials": "ODW"},
        {"name": "Valerie B. Fairbank", "title": "Judge", "initials": "VBF", "notes": "Senior status"},
        {"name": "Dale S. Fischer", "title": "Judge", "initials": "DSF", "notes": "Senior status"},
        {"name": "Terry J. Hatter Jr.", "title": "Judge", "initials": "TJH", "notes": "Senior status"},
        {"name": "John A. Kronstadt", "title": "Judge", "initials": "JAK", "notes": "Senior status"},
        {"name": "Consuelo B. Marshall", "title": "Judge", "initials": "CBM", "notes": "Senior status"},
        {"name": "Virginia A. Phillips", "title": "Judge", "initials": "VAP", "notes": "Senior status"},
        {"name": "James V. Selna", "title": "Judge", "initials": "JVS", "notes": "Senior status"},
        {"name": "Christina A. Snyder", "title": "Judge", "initials": "CAS", "notes": "Senior status"},
        {"name": "George H. Wu", "title": "Judge", "initials": "GW", "notes": "Senior status"},
        # Magistrate Judges
        {"name": "Karen L. Stevenson", "title": "Magistrate", "initials": "KS", "notes": "Chief Magistrate Judge"},
        # Magistrate Judges
        {"name": "Maria A. Audero", "title": "Magistrate", "initials": "MAA"},
        {"name": "David T. Bristow", "title": "Magistrate", "initials": "DTB"},
        {"name": "Pedro V. Castillo", "title": "Magistrate", "initials": "PVC"},
        {"name": "Jacqueline Chooljian", "title": "Magistrate", "initials": "JC"},
        {"name": "Stephanie S. Christensen", "title": "Magistrate", "initials": "SSC"},
        {"name": "Patricia Donahue", "title": "Magistrate", "initials": "PD"},
        {"name": "John D. Early", "title": "Magistrate", "initials": "JDE"},
        {"name": "Charles F. Eick", "title": "Magistrate", "initials": "E"},
        {"name": "Michael B. Kaufman", "title": "Magistrate", "initials": "MBK"},
        {"name": "Steve Kim", "title": "Magistrate", "initials": "SK"},
        {"name": "Douglas F. McCormick", "title": "Magistrate", "initials": "DFM"},
        {"name": "Brianna Fuller Mircheff", "title": "Magistrate", "initials": "BFM"},
        {"name": "Rozella A. Oliver", "title": "Magistrate", "initials": "RAO"},
        {"name": "Sheri Pym", "title": "Magistrate", "initials": "SP"},
        {"name": "A. Joel Richlin", "title": "Magistrate", "initials": "AJR"},
        {"name": "Daniel S. Roberts", "title": "Magistrate", "initials": "DSR"},
        {"name": "Margo A. Rocconi", "title": "Magistrate", "initials": "MAR"},
        {"name": "Alicia G. Rosenberg", "title": "Magistrate", "initials": "AGR"},
        {"name": "Alka Sagar", "title": "Magistrate", "initials": "AS"},
        {"name": "Karen E. Scott", "title": "Magistrate", "initials": "KES"},
        {"name": "Autumn D. Spaeth", "title": "Magistrate", "initials": "ADS"},
        {"name": "Angela C. C. Viramontes", "title": "Magistrate", "initials": "ACCV"},
    ],

    CAED: [
        # District Judges
        {"name": "Troy L. Nunley", "title": "Judge", "initials": "TLN", "notes": "Chief Judge"},
        {"name": "Daniel J. Calabretta", "title": "Judge", "initials": "DJC"},
        {"name": "Dena Coggins", "title": "Judge", "initials": "DC"},
        {"name": "Dale A. Drozd", "title": "Judge", "initials": "DAD"},
        {"name": "Kirk E. Sherriff", "title": "Judge", "initials": "KES"},
        {"name": "Jennifer L. Thurston", "title": "Judge", "initials": "JLT"},
        {"name": "John A. Mendez", "title": "Judge", "initials": "JAM", "notes": "Senior status"},
        {"name": "William B. Shubb", "title": "Judge", "initials": "WBS", "notes": "Senior status"},
        # Magistrate Judges
        {"name": "Carolyn K. Delaney", "title": "Magistrate", "initials": "CKD", "notes": "Chief Magistrate Judge"},
        # Magistrate Judges
        {"name": "Gary S. Austin", "title": "Magistrate", "initials": "GSA", "notes": "Recalled"},
        {"name": "Christopher D. Baker", "title": "Magistrate", "initials": "CDB"},
        {"name": "Helena M. Barch-Kuchta", "title": "Magistrate", "initials": "HBK"},
        {"name": "Stanley A. Boone", "title": "Magistrate", "initials": "SAB"},
        {"name": "Edmund F. Brennan", "title": "Magistrate", "initials": "EFB", "notes": "Recalled"},
        {"name": "Allison Claire", "title": "Magistrate", "initials": "AC"},
        {"name": "Dennis M. Cota", "title": "Magistrate", "initials": "DMC"},
        {"name": "Erica P. Grosjean", "title": "Magistrate", "initials": "EPG"},
        {"name": "Chi Soo Kim", "title": "Magistrate", "initials": "CSK"},
        {"name": "Barbara A. McAuliffe", "title": "Magistrate", "initials": "BAM", "notes": "Recalled"},
        {"name": "Sheila K. Oberto", "title": "Magistrate", "initials": "SKO"},
        {"name": "Jeremy D. Peterson", "title": "Magistrate", "initials": "JDP"},
        {"name": "Sean C. Riordan", "title": "Magistrate", "initials": "SCR"},
    ],

    CAND: [
        # District Judges
        {"name": "Richard Seeborg", "title": "Judge", "initials": "RS", "notes": "Chief Judge"},
        {"name": "Vince Chhabria", "title": "Judge", "initials": "VC"},
        {"name": "Jacqueline Scott Corley", "title": "Judge", "initials": "JSC"},
        {"name": "James Donato", "title": "Judge", "initials": "JD"},
        {"name": "Rita F. Lin", "title": "Judge", "initials": "RFL"},
        {"name": "Araceli Martínez-Olguín", "title": "Judge", "initials": "AMO"},
        {"name": "Trina L. Thompson", "title": "Judge", "initials": "TLT"},
        {"name": "Haywood S. Gilliam, Jr.", "title": "Judge", "initials": "HSG"},
        {"name": "Yvonne Gonzalez Rogers", "title": "Judge", "initials": "YGR"},
        {"name": "Jon S. Tigar", "title": "Judge", "initials": "JST"},
        {"name": "Beth Labson Freeman", "title": "Judge", "initials": "BLF"},
        {"name": "Eumi K. Lee", "title": "Judge", "initials": "EKL"},
        {"name": "P. Casey Pitts", "title": "Judge", "initials": "PCP"},
        {"name": "Noël Wise", "title": "Judge", "initials": "NW"},
        {"name": "Charles R. Breyer", "title": "Judge", "initials": "CRB", "notes": "Senior status"},
        {"name": "Edward M. Chen", "title": "Judge", "initials": "EMC", "notes": "Senior status"},
        {"name": "Maxine M. Chesney", "title": "Judge", "initials": "MMC", "notes": "Senior status"},
        {"name": "Susan Illston", "title": "Judge", "initials": "SI", "notes": "Senior status"},
        {"name": "William H. Orrick", "title": "Judge", "initials": "WHO", "notes": "Senior status"},
        {"name": "Phyllis J. Hamilton", "title": "Judge", "initials": "PJH", "notes": "Senior status"},
        {"name": "Jeffrey S. White", "title": "Judge", "initials": "JSW", "notes": "Senior status"},
        {"name": "Claudia Wilken", "title": "Judge", "initials": "CW", "notes": "Senior status"},
        {"name": "Edward J. Davila", "title": "Judge", "initials": "EJD", "notes": "Senior status"},
        # Magistrate Judges
        {"name": "Nathanael Cousins", "title": "Magistrate", "initials": "NC", "notes": "Chief Magistrate Judge"},
        # Magistrate Judges — San Francisco
        {"name": "Laurel Beeler", "title": "Magistrate", "initials": "LB"},
        {"name": "Lisa J. Cisneros", "title": "Magistrate", "initials": "LJC"},
        {"name": "Thomas S. Hixson", "title": "Magistrate", "initials": "TSH"},
        {"name": "Peter H. Kang", "title": "Magistrate", "initials": "PHK"},
        {"name": "Sallie Kim", "title": "Magistrate", "initials": "SK"},
        {"name": "Joseph C. Spero", "title": "Magistrate", "initials": "JCS"},
        {"name": "Alex G. Tse", "title": "Magistrate", "initials": "AGT"},
        # Magistrate Judges — Eureka
        {"name": "Robert M. Illman", "title": "Magistrate", "initials": "RMI"},
        # Magistrate Judges — Oakland
        {"name": "Ajay S. Krishnan", "title": "Magistrate", "initials": "ASK"},
        {"name": "Kandis A. Westmore", "title": "Magistrate", "initials": "KAW"},
        # Magistrate Judges — San Jose
        {"name": "Virginia K. DeMarchi", "title": "Magistrate", "initials": "VKD"},
        {"name": "Susan van Keulen", "title": "Magistrate", "initials": "SVK"},
    ],

    CASD: [
        # District Judges
        {"name": "Dana M. Sabraw", "title": "Judge", "initials": "DMS", "notes": "Chief Judge"},
        {"name": "Cynthia A. Bashant", "title": "Judge", "initials": "CAB"},
        {"name": "Cathy Ann Bencivengo", "title": "Judge", "initials": "CABe"},
        {"name": "Benjamin J. Cheeks", "title": "Judge", "initials": "BJC"},
        {"name": "Robert S. Huie", "title": "Judge", "initials": "RSH"},
        {"name": "Linda Lopez", "title": "Judge", "initials": "LL"},
        {"name": "Ruth Bermudez Montenegro", "title": "Judge", "initials": "RBM"},
        {"name": "Jinsook Ohta", "title": "Judge", "initials": "JO"},
        {"name": "Todd W. Robinson", "title": "Judge", "initials": "TWR"},
        {"name": "Janis L. Sammartino", "title": "Judge", "initials": "JLS"},
        {"name": "Andrew G. Schopler", "title": "Judge", "initials": "AGS"},
        {"name": "James E. Simmons, Jr.", "title": "Judge", "initials": "JES"},
        {"name": "Michael M. Anello", "title": "Judge", "initials": "MMA", "notes": "Senior status"},
        {"name": "Anthony J. Battaglia", "title": "Judge", "initials": "AJB", "notes": "Senior status"},
        {"name": "Roger T. Benitez", "title": "Judge", "initials": "RTB", "notes": "Senior status"},
        {"name": "Gonzalo P. Curiel", "title": "Judge", "initials": "GPC", "notes": "Senior status"},
        {"name": "William Q. Hayes", "title": "Judge", "initials": "WQH", "notes": "Senior status"},
        {"name": "John A. Houston", "title": "Judge", "initials": "JAH", "notes": "Senior status"},
        {"name": "Marilyn L. Huff", "title": "Judge", "initials": "MLH", "notes": "Senior status"},
        {"name": "M. James Lorenz", "title": "Judge", "initials": "MJL", "notes": "Senior status"},
        {"name": "Jeffrey T. Miller", "title": "Judge", "initials": "JTM", "notes": "Senior status"},
        {"name": "Barry Ted Moskowitz", "title": "Judge", "initials": "BTM", "notes": "Senior status"},
        {"name": "Thomas J. Whelan", "title": "Judge", "initials": "TJW", "notes": "Senior status"},
        # Magistrate Judges
        {"name": "Michael S. Berg", "title": "Magistrate", "initials": "MSB"},
        {"name": "Jill L. Burkhardt", "title": "Magistrate", "initials": "JLB"},
        {"name": "Daniel E. Butcher", "title": "Magistrate", "initials": "DEB"},
        {"name": "Steve B. Chu", "title": "Magistrate", "initials": "SBC"},
        {"name": "Karen S. Crawford", "title": "Magistrate", "initials": "KSC"},
        {"name": "Mitchell D. Dembin", "title": "Magistrate", "initials": "MDD"},
        {"name": "Allison H. Goddard", "title": "Magistrate", "initials": "AHG"},
        {"name": "David D. Leshner", "title": "Magistrate", "initials": "DDL"},
        {"name": "Barbara L. Major", "title": "Magistrate", "initials": "BLM"},
        {"name": "Michelle M. Pettit", "title": "Magistrate", "initials": "MMP"},
        {"name": "Lupe Rodriguez, Jr.", "title": "Magistrate", "initials": "LR"},
        {"name": "Valerie E. Torres", "title": "Magistrate", "initials": "VET"},
        {"name": "Brian J. White", "title": "Magistrate", "initials": "BJW"},
    ],

    CA9: [
        # Circuit Judges
        {"name": "Mary H. Murguia", "title": "Judge", "initials": "MHM", "notes": "Chief Judge"},
        {"name": "Kim McLane Wardlaw", "title": "Judge", "initials": "KMW"},
        {"name": "Ronald M. Gould", "title": "Judge", "initials": "RMG"},
        {"name": "Johnnie B. Rawlinson", "title": "Judge", "initials": "JBR"},
        {"name": "Consuelo M. Callahan", "title": "Judge", "initials": "CMC"},
        {"name": "Milan D. Smith, Jr.", "title": "Judge", "initials": "MDS"},
        {"name": "Morgan Christen", "title": "Judge", "initials": "MBC"},
        {"name": "Jacqueline H. Nguyen", "title": "Judge", "initials": "JHN"},
        {"name": "John B. Owens", "title": "Judge", "initials": "JBO"},
        {"name": "Michelle T. Friedland", "title": "Judge", "initials": "MTF"},
        {"name": "Mark J. Bennett", "title": "Judge", "initials": "MJB"},
        {"name": "Ryan D. Nelson", "title": "Judge", "initials": "RDN"},
        {"name": "Eric D. Miller", "title": "Judge", "initials": "EDM"},
        {"name": "Bridget S. Bade", "title": "Judge", "initials": "BSB"},
        {"name": "Daniel P. Collins", "title": "Judge", "initials": "DPC"},
        {"name": "Kenneth Kiyul Lee", "title": "Judge", "initials": "KKL"},
        {"name": "Daniel A. Bress", "title": "Judge", "initials": "DAB"},
        {"name": "Danielle J. Forrest", "title": "Judge", "initials": "DJF"},
        {"name": "Patrick J. Bumatay", "title": "Judge", "initials": "PJB"},
        {"name": "Lawrence VanDyke", "title": "Judge", "initials": "LVD"},
        {"name": "Lucy H. Koh", "title": "Judge", "initials": "LHK"},
        {"name": "Jennifer Sung", "title": "Judge", "initials": "JS"},
        {"name": "Gabriel P. Sanchez", "title": "Judge", "initials": "GPS"},
        {"name": "Holly A. Thomas", "title": "Judge", "initials": "HAT"},
        {"name": "Salvador Mendoza, Jr.", "title": "Judge", "initials": "SMJ"},
        {"name": "Roopali H. Desai", "title": "Judge", "initials": "RHD"},
        {"name": "Anthony D. Johnstone", "title": "Judge", "initials": "ADJ"},
        {"name": "Ana de Alba", "title": "Judge", "initials": "ADA"},
        {"name": "Eric C. Tung", "title": "Judge", "initials": "ECT"},
        # Senior Circuit Judges
        {"name": "J. Clifford Wallace", "title": "Judge", "initials": "JCW", "notes": "Senior status"},
        {"name": "Mary M. Schroeder", "title": "Judge", "initials": "MMS", "notes": "Senior status"},
        {"name": "Dorothy W. Nelson", "title": "Judge", "initials": "DWN", "notes": "Senior status"},
        {"name": "William C. Canby, Jr.", "title": "Judge", "initials": "WCC", "notes": "Senior status"},
        {"name": "Diarmuid F. O'Scannlain", "title": "Judge", "initials": "DFO", "notes": "Senior status"},
        {"name": "Stephen S. Trott", "title": "Judge", "initials": "SST", "notes": "Senior status"},
        {"name": "Ferdinand F. Fernandez", "title": "Judge", "initials": "FFF", "notes": "Senior status"},
        {"name": "Michael Daly Hawkins", "title": "Judge", "initials": "MDH", "notes": "Senior status"},
        {"name": "A. Wallace Tashima", "title": "Judge", "initials": "AWT", "notes": "Senior status"},
        {"name": "Sidney R. Thomas", "title": "Judge", "initials": "SRT", "notes": "Senior status"},
        {"name": "Barry G. Silverman", "title": "Judge", "initials": "BGS", "notes": "Senior status"},
        {"name": "Susan P. Graber", "title": "Judge", "initials": "SPG", "notes": "Senior status"},
        {"name": "M. Margaret McKeown", "title": "Judge", "initials": "MMM", "notes": "Senior status"},
        {"name": "William A. Fletcher", "title": "Judge", "initials": "WAF", "notes": "Senior status"},
        {"name": "Richard A. Paez", "title": "Judge", "initials": "RAP", "notes": "Senior status"},
        {"name": "Marsha S. Berzon", "title": "Judge", "initials": "MSB", "notes": "Senior status"},
        {"name": "Richard C. Tallman", "title": "Judge", "initials": "RCT", "notes": "Senior status"},
        {"name": "Richard R. Clifton", "title": "Judge", "initials": "RRC", "notes": "Senior status"},
        {"name": "Jay S. Bybee", "title": "Judge", "initials": "JSB", "notes": "Senior status"},
        {"name": "Carlos T. Bea", "title": "Judge", "initials": "CTB", "notes": "Senior status"},
        {"name": "N. Randy Smith", "title": "Judge", "initials": "NRS", "notes": "Senior status"},
        {"name": "Andrew D. Hurwitz", "title": "Judge", "initials": "ADH", "notes": "Senior status"},
    ],
}


def seed_judges():
    """Seed judges for CA federal district courts. Idempotent — creates new, updates titles on existing."""
    with SessionLocal() as session:
        # Build jurisdiction name -> id map
        jurisdictions = session.query(Jurisdiction).all()
        jmap = {j.name: j.id for j in jurisdictions}

        # Load existing judges keyed by (name, jurisdiction_id)
        existing = session.scalars(select(Judge)).all()
        existing_map = {(j.name, j.jurisdiction_id): j for j in existing}

        created = 0
        updated = 0
        skipped = 0

        for jurisdiction_name, judges in JUDGES.items():
            jid = jmap.get(jurisdiction_name)
            if not jid:
                print(f"  WARNING: Jurisdiction '{jurisdiction_name}' not found, skipping its judges")
                continue

            for jdata in judges:
                key = (jdata["name"], jid)
                existing_judge = existing_map.get(key)

                if existing_judge:
                    # Update title/initials/notes if they differ
                    changed = False
                    if jdata.get("title") and existing_judge.title != jdata["title"]:
                        existing_judge.title = jdata["title"]
                        changed = True
                    if jdata.get("initials") and existing_judge.initials != jdata["initials"]:
                        existing_judge.initials = jdata["initials"]
                        changed = True
                    if jdata.get("notes") and existing_judge.notes != jdata["notes"]:
                        existing_judge.notes = jdata["notes"]
                        changed = True
                    if changed:
                        updated += 1
                    else:
                        skipped += 1
                    continue

                judge = Judge(
                    name=jdata["name"],
                    title=jdata.get("title"),
                    initials=jdata.get("initials"),
                    jurisdiction_id=jid,
                    status=jdata.get("status", "Active"),
                    notes=jdata.get("notes"),
                    phones=[],
                    emails=[],
                )
                session.add(judge)
                created += 1

        session.commit()

    print(f"Judges seeded: {created} created, {updated} updated, {skipped} unchanged.")


if __name__ == "__main__":
    seed_judges()
