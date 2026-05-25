#!/usr/bin/env python3
"""
Development / Staging Seed Data for Galipo

Populates the database with realistic mock data for development and staging.

Usage:
    set -a && source .env && set +a
    python scripts/seed_dev_data.py

This will add:
- 18 cases at various litigation stages
- 40+ persons (clients, attorneys, experts, defendants, mediators, etc.)
- 6 judges
- Case-person role assignments + proceedings
- Events/deadlines, tasks, notes
- 10 intakes at various statuses
- Payees, invoices, liens
- Financial records for resolved cases
- Webhook logs
"""

import os
import sys
from datetime import datetime, timedelta, date
import random

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import db


def seed_dev_data():
    """Seed the database with development mock data.

    Clears all entity data first (keeps users and lookup tables),
    so it's safe to run on every deploy without duplicating data.
    """

    print("Seeding development data...")

    from db.session import SessionLocal
    from sqlalchemy import select, text
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from models import User

    # Clear existing entity data first to prevent duplicates on re-deploy
    print("  Clearing existing entity data...")
    with SessionLocal() as session:
        # TRUNCATE CASCADE handles FK dependencies
        session.execute(text("""
            TRUNCATE TABLE
                cases, persons, judges, proceedings, proceeding_judges,
                events, tasks, notes, person_roles, intakes, intake_comments,
                payees, invoices, liens, case_financials, case_counsel_fees,
                webhook_logs, case_comments, sms_conversations
            CASCADE
        """))
        session.commit()
    print("  Entity data cleared.")

    print("  Seeding lookup tables...")
    db.seed_db()

    # ========== USERS ==========
    # Seed all firm users explicitly (db.seed_db -> seed_dev_users only works on
    # localhost databases; this ensures users exist on remote staging too).
    print("  Creating users...")

    SEED_PASSWORD = "home3232"
    password_hash = db.hash_password(SEED_PASSWORD)

    FIRM_USERS = [
        # Paralegals (created first for FK references)
        {"email": "slaurel@example.com", "first_name": "Santiago", "last_name": "Laurel", "initials": "SGL", "bar_number": None, "position": "paralegal", "is_admin": False},
        {"email": "dgilbert@example.com", "first_name": "Darci", "last_name": "Gilbert", "initials": "DG", "bar_number": None, "position": "paralegal", "is_admin": False},
        {"email": "ldeleon@example.com", "first_name": "Leslie", "last_name": "DeLeon", "initials": "LL", "bar_number": None, "position": "paralegal", "is_admin": False},
        {"email": "amonguia@example.com", "first_name": "Alejandro", "last_name": "Monguia", "initials": "AM", "bar_number": None, "position": "paralegal", "is_admin": False},
        # Attorneys
        {"email": "someone@example.com", "first_name": "Dale", "last_name": "Galipo", "initials": "DKG", "bar_number": "144074", "position": "attorney", "is_admin": False},
        {"email": "rvalentine@example.com", "first_name": "Renee", "last_name": "Valentine", "initials": "RVM", "bar_number": "281819", "position": "attorney", "is_admin": False, "paralegal_email": "dgilbert@example.com"},
        {"email": "evalenzuela@example.com", "first_name": "Eric", "last_name": "Valenzuela", "initials": "EV", "bar_number": "284500", "position": "attorney", "is_admin": False, "paralegal_email": "ldeleon@example.com"},
        {"email": "hlee@example.com", "first_name": "Hang", "last_name": "Lee", "initials": "HL", "bar_number": "293450", "position": "attorney", "is_admin": False, "paralegal_email": "slaurel@example.com"},
        {"email": "msincich@example.com", "first_name": "Marcel", "last_name": "Sincich", "initials": "MFS", "bar_number": "319508", "position": "attorney", "is_admin": False, "paralegal_email": "ldeleon@example.com"},
        {"email": "blevine@example.com", "first_name": "Ben", "last_name": "Levine", "initials": "BL", "bar_number": "342060", "position": "attorney", "is_admin": False, "paralegal_email": "slaurel@example.com"},
        {"email": "cmayne@example.com", "first_name": "Cooper", "last_name": "Mayne", "initials": "CM", "bar_number": "343169", "position": "attorney", "is_admin": True, "paralegal_email": "dgilbert@example.com"},
        {"email": "bjohnson@example.com", "first_name": "Brendan", "last_name": "Johnson", "initials": "BJ", "bar_number": None, "position": "attorney", "is_admin": False, "paralegal_email": "ldeleon@example.com"},
        # Manager
        {"email": "davegalipo@example.com", "first_name": "Dave", "last_name": "Galipo", "initials": "DG", "bar_number": None, "position": "manager", "is_admin": False},
    ]

    user_ids = {}
    with SessionLocal() as session:
        for user in FIRM_USERS:
            stmt = pg_insert(User).values(
                email=user["email"].lower(),
                password_hash=password_hash,
                first_name=user["first_name"],
                last_name=user["last_name"],
                initials=user["initials"],
                bar_number=user["bar_number"],
                position=user["position"],
                is_admin=user["is_admin"],
                must_change_password=False,
            ).on_conflict_do_update(
                index_elements=["email"],
                set_={
                    "password_hash": password_hash,
                    "first_name": user["first_name"],
                    "last_name": user["last_name"],
                    "initials": user["initials"],
                    "bar_number": user["bar_number"],
                    "position": user["position"],
                    "is_admin": user["is_admin"],
                    "must_change_password": False,
                    "is_active": True,
                    "updated_at": text("CURRENT_TIMESTAMP"),
                },
            ).returning(User.id)
            result = session.execute(stmt)
            row = result.fetchone()
            user_ids[user["email"].lower()] = row[0]

        # Set paralegal relationships
        for user in FIRM_USERS:
            if user.get("paralegal_email"):
                paralegal_id = user_ids.get(user["paralegal_email"].lower())
                if paralegal_id:
                    db_user = session.scalar(
                        select(User).where(User.email == user["email"].lower())
                    )
                    if db_user:
                        db_user.paralegal_id = paralegal_id

        session.commit()

    print(f"  {len(FIRM_USERS)} users created (password: {SEED_PASSWORD})")

    jurisdictions = db.get_jurisdictions()
    jurisdiction_map = {j["name"]: j["id"] for j in jurisdictions}

    all_roles = db.get_roles()
    role_map = {r["name"]: r["id"] for r in all_roles}

    # ========== PERSONS ==========
    print("  Creating persons...")
    persons = []

    clients_data = [
        {"name": "Maria Elena Martinez", "phones": [{"value": "310-555-1234", "label": "Cell", "primary": True}],
         "emails": [{"value": "maria.martinez@email.com", "label": "Personal", "primary": True}]},
        {"name": "James Robert Wilson", "phones": [{"value": "213-555-5678", "label": "Cell", "primary": True}],
         "emails": [{"value": "jwilson@gmail.com", "label": "Personal", "primary": True}]},
        {"name": "Nguyen Thi Phuong", "phones": [{"value": "626-555-9012", "label": "Cell", "primary": True}],
         "emails": [{"value": "phuong.nguyen@yahoo.com", "label": "Personal", "primary": True}]},
        {"name": "Robert Charles Thompson", "phones": [{"value": "818-555-3456", "label": "Cell", "primary": True}, {"value": "818-555-3457", "label": "Work", "primary": False}],
         "emails": [{"value": "rthompson@outlook.com", "label": "Personal", "primary": True}]},
        {"name": "Samantha Lynn Chen", "phones": [{"value": "949-555-7890", "label": "Cell", "primary": True}],
         "emails": [{"value": "samantha.chen@icloud.com", "label": "Personal", "primary": True}]},
        {"name": "Marcus Anthony Davis", "phones": [{"value": "562-555-2345", "label": "Cell", "primary": True}],
         "emails": [{"value": "mdavis_law@gmail.com", "label": "Personal", "primary": True}]},
        {"name": "Patricia Ann O'Brien", "phones": [{"value": "714-555-6789", "label": "Cell", "primary": True}],
         "emails": [{"value": "pobrien55@hotmail.com", "label": "Personal", "primary": True}]},
        {"name": "David Kim", "phones": [{"value": "323-555-0123", "label": "Cell", "primary": True}],
         "emails": [{"value": "david.kim.la@gmail.com", "label": "Personal", "primary": True}]},
        {"name": "Angela Reyes", "phones": [{"value": "818-555-4411", "label": "Cell", "primary": True}],
         "emails": [{"value": "angela.reyes@gmail.com", "label": "Personal", "primary": True}]},
        {"name": "Thomas Wayne Brooks", "phones": [{"value": "310-555-7722", "label": "Cell", "primary": True}],
         "emails": [{"value": "twbrooks@outlook.com", "label": "Personal", "primary": True}]},
        {"name": "Lisa Marie Fontana", "phones": [{"value": "626-555-3388", "label": "Cell", "primary": True}],
         "emails": [{"value": "lisa.fontana@icloud.com", "label": "Personal", "primary": True}]},
        {"name": "Kevin Okafor", "phones": [{"value": "213-555-9944", "label": "Cell", "primary": True}],
         "emails": [{"value": "kokafor@yahoo.com", "label": "Personal", "primary": True}]},
        {"name": "Sandra Gutierrez", "phones": [{"value": "562-555-6677", "label": "Cell", "primary": True}],
         "emails": [{"value": "sgutierrez@gmail.com", "label": "Personal", "primary": True}]},
        {"name": "Raymond Holt", "phones": [{"value": "714-555-2299", "label": "Cell", "primary": True}],
         "emails": [{"value": "rholt99@hotmail.com", "label": "Personal", "primary": True}]},
        {"name": "Diana Tran", "phones": [{"value": "949-555-8811", "label": "Cell", "primary": True}],
         "emails": [{"value": "diana.tran@email.com", "label": "Personal", "primary": True}]},
        {"name": "Michael Petrov", "phones": [{"value": "323-555-5566", "label": "Cell", "primary": True}],
         "emails": [{"value": "mpetrov@gmail.com", "label": "Personal", "primary": True}]},
        {"name": "Carla Washington", "phones": [{"value": "818-555-1177", "label": "Cell", "primary": True}],
         "emails": [{"value": "cwashington@outlook.com", "label": "Personal", "primary": True}]},
        {"name": "Jorge Mendez", "phones": [{"value": "310-555-3344", "label": "Cell", "primary": True}],
         "emails": [{"value": "jmendez@gmail.com", "label": "Personal", "primary": True}]},
        # Decedent (for wrongful death case)
        {"name": "Frank Reyes", "phones": [], "emails": []},
        # Contacts (family members who are case contacts)
        {"name": "Rosa Mendez", "phones": [{"value": "310-555-3345", "label": "Cell", "primary": True}],
         "emails": [{"value": "rosamendez@gmail.com", "label": "Personal", "primary": True}]},
    ]

    for c in clients_data:
        person = db.create_person(
            name=c["name"],
            phones=c.get("phones"),
            emails=c.get("emails"),
        )
        persons.append({"id": person["id"], "name": c["name"]})

    defendants_data = [
        {"name": "City of Los Angeles", "organization": "City of Los Angeles",
         "phones": [{"value": "213-978-8100", "label": "Main", "primary": True}]},
        {"name": "Los Angeles Police Department", "organization": "City of Los Angeles"},
        {"name": "County of Los Angeles", "organization": "County of Los Angeles"},
        {"name": "ABC Trucking Inc.", "organization": "ABC Trucking Inc.",
         "phones": [{"value": "800-555-8888", "label": "Main", "primary": True}],
         "address": "1234 Industrial Way, Commerce, CA 90040"},
        {"name": "Metro Transit Authority", "organization": "Los Angeles County MTA"},
        {"name": "Westside Medical Center", "organization": "Westside Medical Center",
         "address": "5000 W Olympic Blvd, Los Angeles, CA 90019"},
        {"name": "Officer John Smith (Badge #12345)", "organization": "LAPD"},
        {"name": "Officer Jane Doe (Badge #67890)", "organization": "LAPD"},
        {"name": "Vons Grocery #1247", "organization": "Albertsons Companies",
         "address": "3461 W 3rd St, Los Angeles, CA 90020"},
        {"name": "Pacific Coast Properties LLC", "organization": "Pacific Coast Properties LLC",
         "address": "9000 Sunset Blvd, Suite 400, West Hollywood, CA 90069"},
        {"name": "LA Unified School District", "organization": "LAUSD",
         "phones": [{"value": "213-241-1000", "label": "Main", "primary": True}]},
        {"name": "Rideshare Corp (Uber)", "organization": "Uber Technologies, Inc."},
        {"name": "John Doe Driver", "organization": None},
        {"name": "Kaiser Permanente", "organization": "Kaiser Foundation Hospitals",
         "address": "4867 Sunset Blvd, Los Angeles, CA 90027"},
        {"name": "City of Pasadena", "organization": "City of Pasadena"},
        {"name": "Officer Miguel Torres (Badge #44221)", "organization": "LAPD"},
        {"name": "Sergeant Karen Wells (Badge #33100)", "organization": "LA County Sheriff"},
        {"name": "Big Box Retail Inc.", "organization": "Big Box Retail Inc.",
         "address": "10200 Sepulveda Blvd, Mission Hills, CA 91345"},
    ]

    for d in defendants_data:
        person = db.create_person(
            name=d["name"],
            organization=d.get("organization"),
            phones=d.get("phones"),
            address=d.get("address"),
        )
        persons.append({"id": person["id"], "name": d["name"]})

    opp_counsel_data = [
        {"name": "Michael Richardson", "organization": "City Attorney's Office",
         "phones": [{"value": "213-978-8100", "label": "Office", "primary": True}],
         "emails": [{"value": "michael.richardson@lacity.org", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 198765"}},
        {"name": "Jennifer Walsh", "organization": "Walsh & Associates",
         "phones": [{"value": "310-555-4567", "label": "Office", "primary": True}],
         "emails": [{"value": "jwalsh@walshlaw.com", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 234567"}},
        {"name": "David Chen", "organization": "County Counsel",
         "phones": [{"value": "213-974-1801", "label": "Office", "primary": True}],
         "emails": [{"value": "dchen@counsel.lacounty.gov", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 187654"}},
        {"name": "Karen Blackwell", "organization": "Blackwell & Park LLP",
         "phones": [{"value": "310-555-8800", "label": "Office", "primary": True}],
         "emails": [{"value": "kblackwell@bpllp.com", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 210443"}},
        {"name": "Steven Nakamura", "organization": "Lewis Brisbois",
         "phones": [{"value": "213-555-7700", "label": "Office", "primary": True}],
         "emails": [{"value": "steven.nakamura@lewisbrisbois.com", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 256789"}},
        {"name": "Rachel Torres", "organization": "City Attorney's Office - Pasadena",
         "phones": [{"value": "626-555-4400", "label": "Office", "primary": True}],
         "emails": [{"value": "rtorres@cityofpasadena.net", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 278901"}},
    ]

    for a in opp_counsel_data:
        person = db.create_person(
            name=a["name"],
            organization=a.get("organization"),
            phones=a.get("phones"),
            emails=a.get("emails"),
        )
        persons.append({"id": person["id"], "name": a["name"], "attributes": a.get("attributes")})

    co_counsel_data = [
        {"name": "Amanda Foster", "organization": "Foster Civil Rights Law",
         "phones": [{"value": "310-555-9911", "label": "Office", "primary": True}],
         "emails": [{"value": "afoster@fostercivilrights.com", "label": "Work", "primary": True}],
         "attributes": {"bar_number": "SBN 245678"}},
    ]

    for cc in co_counsel_data:
        person = db.create_person(
            name=cc["name"],
            organization=cc.get("organization"),
            phones=cc.get("phones"),
            emails=cc.get("emails"),
        )
        persons.append({"id": person["id"], "name": cc["name"], "role": "co_counsel", "attributes": cc.get("attributes")})

    experts_data = [
        {"name": "Dr. Sarah Mitchell", "organization": "Mitchell Biomechanics Group",
         "phones": [{"value": "858-555-1111", "label": "Office", "primary": True}],
         "emails": [{"value": "dr.mitchell@mitchellbiomech.com", "label": "Work", "primary": True}],
         "attributes": {"hourly_rate": 650, "deposition_rate": 750, "trial_rate": 850,
                        "expertises": ["Biomechanics", "Accident Reconstruction"]}},
        {"name": "Dr. Michael Wong", "organization": "UCLA Medical Center",
         "phones": [{"value": "310-555-2222", "label": "Office", "primary": True}],
         "emails": [{"value": "mwong@mednet.ucla.edu", "label": "Work", "primary": True}],
         "attributes": {"hourly_rate": 800, "deposition_rate": 900, "trial_rate": 1000,
                        "expertises": ["Medical - Orthopedic"]}},
        {"name": "Dr. Linda Park", "organization": "Southern California Neurology",
         "phones": [{"value": "626-555-3333", "label": "Office", "primary": True}],
         "emails": [{"value": "lpark@socalneurology.com", "label": "Work", "primary": True}],
         "attributes": {"hourly_rate": 750, "deposition_rate": 850, "trial_rate": 950,
                        "expertises": ["Medical - Neurology"]}},
        {"name": "Dr. James Harrison", "organization": "Harrison Economics",
         "phones": [{"value": "213-555-4444", "label": "Office", "primary": True}],
         "emails": [{"value": "jharrison@harrisonecon.com", "label": "Work", "primary": True}],
         "attributes": {"hourly_rate": 500, "deposition_rate": 600, "trial_rate": 700,
                        "expertises": ["Economics/Damages", "Life Care Planning"]}},
        {"name": "Dr. Patricia Gomez", "organization": "Gomez Radiology Associates",
         "phones": [{"value": "310-555-6600", "label": "Office", "primary": True}],
         "emails": [{"value": "pgomez@gomezrad.com", "label": "Work", "primary": True}],
         "attributes": {"hourly_rate": 700, "deposition_rate": 800, "trial_rate": 900,
                        "expertises": ["Medical - Radiology"]}},
    ]

    for e in experts_data:
        person = db.create_person(
            name=e["name"],
            organization=e.get("organization"),
            phones=e.get("phones"),
            emails=e.get("emails"),
        )
        persons.append({"id": person["id"], "name": e["name"], "attributes": e.get("attributes")})

    mediators_data = [
        {"name": "Hon. Gerald Rosen (Ret.)", "organization": "JAMS",
         "phones": [{"value": "213-620-1133", "label": "JAMS", "primary": True}],
         "emails": [{"value": "grosen@jamsadr.com", "label": "Work", "primary": True}],
         "attributes": {"half_day_rate": 5000, "full_day_rate": 9000, "style": "Facilitative"}},
        {"name": "Jeffrey Krivis", "organization": "First Mediation",
         "phones": [{"value": "310-284-3888", "label": "Office", "primary": True}],
         "emails": [{"value": "jkrivis@firstmediation.com", "label": "Work", "primary": True}],
         "attributes": {"half_day_rate": 4500, "full_day_rate": 8000, "style": "Evaluative"}},
    ]

    for m in mediators_data:
        person = db.create_person(
            name=m["name"],
            organization=m.get("organization"),
            phones=m.get("phones"),
            emails=m.get("emails"),
        )
        persons.append({"id": person["id"], "name": m["name"], "attributes": m.get("attributes")})

    adjusters_data = [
        {"name": "Brian Keller", "organization": "Gallagher Bassett",
         "phones": [{"value": "800-555-3300", "label": "Office", "primary": True}],
         "emails": [{"value": "brian.keller@gallagherbassett.com", "label": "Work", "primary": True}]},
        {"name": "Patricia Simmons", "organization": "The Doctors Company",
         "phones": [{"value": "800-555-4400", "label": "Office", "primary": True}],
         "emails": [{"value": "psimmons@thedoctors.com", "label": "Work", "primary": True}]},
    ]

    for adj in adjusters_data:
        person = db.create_person(
            name=adj["name"],
            organization=adj.get("organization"),
            phones=adj.get("phones"),
            emails=adj.get("emails"),
        )
        persons.append({"id": person["id"], "name": adj["name"]})

    # ========== JUDGES ==========
    print("  Creating judges...")

    judges_data = [
        {"name": "Hon. Patricia Collins", "jurisdiction": "C.D. Cal.",
         "courtroom_number": "8A", "initials": "PAC", "title": "Judge"},
        {"name": "Hon. Robert Takahashi", "jurisdiction": "Los Angeles Superior",
         "courtroom_number": "312", "initials": "RT", "title": "Judge"},
        {"name": "Hon. Maria Santos", "jurisdiction": "C.D. Cal.",
         "courtroom_number": "6B", "initials": "MLS", "title": "Magistrate"},
        {"name": "Hon. William Foster", "jurisdiction": "Los Angeles Superior",
         "courtroom_number": "504", "initials": "WF", "title": "Judge"},
        {"name": "Hon. David Yoon", "jurisdiction": "Los Angeles Superior",
         "courtroom_number": "219", "initials": "DY", "title": "Judge"},
        {"name": "Hon. Catherine Perez", "jurisdiction": "C.D. Cal.",
         "courtroom_number": "12C", "initials": "CP", "title": "Judge"},
    ]

    judges = []
    for j in judges_data:
        judge = db.create_judge(
            name=j["name"],
            jurisdiction_id=jurisdiction_map.get(j["jurisdiction"]),
            courtroom_number=j.get("courtroom_number"),
            initials=j.get("initials"),
            title=j.get("title"),
        )
        judges.append({"id": judge["id"], "name": j["name"]})

    def find_person(name):
        for p in persons:
            if p["name"] == name:
                return p
        return None

    def find_judge(name):
        for j in judges:
            if j["name"] == name:
                return j["id"]
        return None

    # ========== CASES ==========
    print("  Creating cases...")

    today = date.today()

    cases_data = [
        # 1: Active federal civil rights - Discovery
        {
            "case_name": "Martinez v. City of Los Angeles",
            "short_name": "Martinez",
            "status": "Discovery",
            "case_summary": "Section 1983 excessive force claim. Client was stopped by LAPD officers during a traffic stop and alleges she was subjected to excessive force, resulting in a torn rotator cuff and PTSD.",
            "date_of_injury": "2023-06-15",
            "client": "Maria Elena Martinez",
            "defendants": [("City of Los Angeles", "municipality_defendant"), ("Los Angeles Police Department", "municipality_defendant"), ("Officer John Smith (Badge #12345)", "individual_defendant")],
            "opp_counsel": "Michael Richardson",
            "judge": "Hon. Patricia Collins",
            "experts": ["Dr. Sarah Mitchell", "Dr. Michael Wong"],
        },
        # 2: Trucking accident - Expert Discovery
        {
            "case_name": "Wilson v. ABC Trucking Inc.",
            "short_name": "Wilson",
            "status": "Expert Discovery",
            "case_summary": "Trucking accident on I-10. Client was rear-ended by defendant's 18-wheeler. Suffered lumbar disc herniation requiring surgery.",
            "date_of_injury": "2022-11-20",
            "client": "James Robert Wilson",
            "defendants": [("ABC Trucking Inc.", "municipality_defendant")],
            "opp_counsel": "Jennifer Walsh",
            "judge": "Hon. Robert Takahashi",
            "experts": ["Dr. Sarah Mitchell", "Dr. Linda Park", "Dr. James Harrison"],
        },
        # 3: Bus accident - Pre-trial
        {
            "case_name": "Nguyen v. Metro Transit Authority",
            "short_name": "Nguyen",
            "status": "Pre-trial",
            "case_summary": "Bus accident case. Client was a passenger on MTA bus that collided with another vehicle. TBI and cervical injuries.",
            "date_of_injury": "2022-03-08",
            "client": "Nguyen Thi Phuong",
            "defendants": [("Metro Transit Authority", "municipality_defendant")],
            "opp_counsel": "David Chen",
            "judge": "Hon. William Foster",
            "experts": ["Dr. Linda Park", "Dr. James Harrison"],
        },
        # 4: False arrest - Pleadings
        {
            "case_name": "Thompson v. County of Los Angeles",
            "short_name": "Thompson",
            "status": "Pleadings",
            "case_summary": "False arrest and malicious prosecution. Client was wrongfully arrested and held for 48 hours before charges were dropped.",
            "date_of_injury": "2024-01-10",
            "client": "Robert Charles Thompson",
            "defendants": [("County of Los Angeles", "municipality_defendant")],
            "opp_counsel": "David Chen",
            "judge": "Hon. Maria Santos",
            "experts": [],
        },
        # 5: Medical malpractice - Settl. Pend.
        {
            "case_name": "Chen v. Westside Medical Center",
            "short_name": "Chen",
            "status": "Settl. Pend.",
            "case_summary": "Medical malpractice - delayed diagnosis of appendicitis leading to rupture and sepsis.",
            "date_of_injury": "2022-09-05",
            "client": "Samantha Lynn Chen",
            "defendants": [("Westside Medical Center", "municipality_defendant")],
            "opp_counsel": "Jennifer Walsh",
            "judge": "Hon. Robert Takahashi",
            "experts": ["Dr. Michael Wong"],
        },
        # 6: New intake - Signing Up
        {
            "case_name": "Davis v. City of Los Angeles",
            "short_name": "Davis",
            "status": "Signing Up",
            "case_summary": "Potential excessive force case. Client alleges he was beaten during arrest. Still gathering records.",
            "date_of_injury": "2024-10-01",
            "client": "Marcus Anthony Davis",
            "defendants": [("City of Los Angeles", "municipality_defendant"), ("Officer Jane Doe (Badge #67890)", "individual_defendant")],
            "opp_counsel": None,
            "judge": None,
            "experts": [],
        },
        # 7: Closed - Trucking
        {
            "case_name": "O'Brien v. ABC Trucking Inc.",
            "short_name": "O'Brien",
            "status": "Closed",
            "case_summary": "Trucking accident on PCH. Settled for $1.2M after mediation.",
            "date_of_injury": "2020-12-15",
            "result": "Settled - $1,200,000",
            "client": "Patricia Ann O'Brien",
            "defendants": [("ABC Trucking Inc.", "municipality_defendant")],
            "opp_counsel": "Jennifer Walsh",
            "judge": "Hon. William Foster",
            "experts": ["Dr. Sarah Mitchell", "Dr. James Harrison"],
        },
        # 8: Pre-Filing investigation
        {
            "case_name": "Kim v. Unknown Defendants",
            "short_name": "Kim",
            "status": "Pre-Filing",
            "case_summary": "Hit and run investigation. Client was struck while crossing in crosswalk. Investigating to identify defendant.",
            "date_of_injury": "2024-09-15",
            "client": "David Kim",
            "defendants": [],
            "opp_counsel": None,
            "judge": None,
            "experts": [],
        },
        # 9: Wrongful death - Discovery
        {
            "case_name": "Reyes v. City of Los Angeles",
            "short_name": "Reyes",
            "status": "Discovery",
            "case_summary": "Wrongful death / excessive force. Decedent Frank Reyes was shot and killed by LAPD during a mental health crisis response. Successor-in-interest Angela Reyes (wife) is plaintiff.",
            "date_of_injury": "2024-02-14",
            "client": "Angela Reyes",
            "decedent": "Frank Reyes",
            "defendants": [("City of Los Angeles", "municipality_defendant"), ("Los Angeles Police Department", "municipality_defendant"), ("Officer Miguel Torres (Badge #44221)", "individual_defendant")],
            "opp_counsel": "Michael Richardson",
            "co_counsel": "Amanda Foster",
            "judge": "Hon. Catherine Perez",
            "experts": ["Dr. Sarah Mitchell"],
        },
        # 10: Premises liability - Expert Discovery
        {
            "case_name": "Brooks v. Vons Grocery #1247",
            "short_name": "Brooks",
            "status": "Expert Discovery",
            "case_summary": "Slip and fall on wet floor in grocery store. Client suffered broken hip requiring replacement surgery. Store failed to post warning signs.",
            "date_of_injury": "2023-08-22",
            "client": "Thomas Wayne Brooks",
            "defendants": [("Vons Grocery #1247", "municipality_defendant")],
            "opp_counsel": "Steven Nakamura",
            "judge": "Hon. David Yoon",
            "experts": ["Dr. Michael Wong", "Dr. Patricia Gomez"],
        },
        # 11: Dangerous condition of public property - Pleadings
        {
            "case_name": "Fontana v. City of Pasadena",
            "short_name": "Fontana",
            "status": "Pleadings",
            "case_summary": "Dangerous condition of public property. Client tripped on an uplifted sidewalk, fell face-first, and suffered orbital fracture and concussion.",
            "date_of_injury": "2025-01-03",
            "client": "Lisa Marie Fontana",
            "defendants": [("City of Pasadena", "municipality_defendant")],
            "opp_counsel": "Rachel Torres",
            "judge": None,
            "experts": [],
        },
        # 12: Rideshare accident - Discovery
        {
            "case_name": "Okafor v. Rideshare Corp",
            "short_name": "Okafor",
            "status": "Discovery",
            "case_summary": "Client was passenger in Uber when driver ran a red light and was T-boned. Multiple fractures and nerve damage in left arm.",
            "date_of_injury": "2024-04-19",
            "client": "Kevin Okafor",
            "defendants": [("Rideshare Corp (Uber)", "municipality_defendant"), ("John Doe Driver", "individual_defendant")],
            "opp_counsel": "Karen Blackwell",
            "judge": "Hon. Robert Takahashi",
            "experts": ["Dr. Linda Park"],
        },
        # 13: School district negligence - Pre-Claim
        {
            "case_name": "Gutierrez v. LA Unified School District",
            "short_name": "Gutierrez",
            "status": "Pre-Claim",
            "case_summary": "Child was assaulted on school grounds during recess. School failed to provide adequate supervision. TBI and emotional trauma.",
            "date_of_injury": "2025-02-10",
            "client": "Sandra Gutierrez",
            "defendants": [("LA Unified School District", "municipality_defendant")],
            "opp_counsel": None,
            "judge": None,
            "experts": [],
        },
        # 14: Jail excessive force - Discovery
        {
            "case_name": "Holt v. County of Los Angeles",
            "short_name": "Holt",
            "status": "Discovery",
            "case_summary": "Excessive force in LA County jail. Client was restrained and beaten by deputies while in custody. Fractured ribs and lacerations.",
            "date_of_injury": "2024-06-30",
            "client": "Raymond Holt",
            "defendants": [("County of Los Angeles", "municipality_defendant"), ("Sergeant Karen Wells (Badge #33100)", "individual_defendant")],
            "opp_counsel": "David Chen",
            "judge": "Hon. Patricia Collins",
            "experts": ["Dr. Patricia Gomez"],
        },
        # 15: Medical malpractice - Closed (settled)
        {
            "case_name": "Tran v. Kaiser Permanente",
            "short_name": "Tran",
            "status": "Closed",
            "case_summary": "Surgical error during gallbladder removal resulted in bile duct injury requiring corrective surgery. Settled for $650,000.",
            "date_of_injury": "2021-11-08",
            "result": "Settled - $650,000",
            "client": "Diana Tran",
            "defendants": [("Kaiser Permanente", "municipality_defendant")],
            "opp_counsel": "Steven Nakamura",
            "judge": "Hon. David Yoon",
            "experts": ["Dr. Michael Wong"],
        },
        # 16: Premises liability - Pre-Claim
        {
            "case_name": "Petrov v. Big Box Retail Inc.",
            "short_name": "Petrov",
            "status": "Pre-Claim",
            "case_summary": "Shelving unit collapse at retail store. Client was struck by falling merchandise, suffered shoulder injury. Investigating liability.",
            "date_of_injury": "2025-04-01",
            "client": "Michael Petrov",
            "defendants": [("Big Box Retail Inc.", "municipality_defendant")],
            "opp_counsel": None,
            "judge": None,
            "experts": [],
        },
        # 17: Police shooting - Trial
        {
            "case_name": "Washington v. City of Los Angeles",
            "short_name": "Washington",
            "status": "Trial",
            "trial_date": (today + timedelta(days=14)).isoformat(),
            "case_summary": "Officer-involved shooting. Client was unarmed and shot in the leg during a warrant service at wrong address. Permanent nerve damage.",
            "date_of_injury": "2022-07-04",
            "client": "Carla Washington",
            "defendants": [("City of Los Angeles", "municipality_defendant"), ("Los Angeles Police Department", "municipality_defendant")],
            "opp_counsel": "Michael Richardson",
            "co_counsel": "Amanda Foster",
            "judge": "Hon. Catherine Perez",
            "experts": ["Dr. Sarah Mitchell", "Dr. Linda Park", "Dr. James Harrison"],
        },
        # 18: Wrongful death / auto accident - Settl. Pend.
        {
            "case_name": "Mendez v. Pacific Coast Properties LLC",
            "short_name": "Mendez",
            "status": "Settl. Pend.",
            "case_summary": "Wrongful death. Decedent struck by vehicle in parking structure with known blind spot. Property owner ignored prior complaints. Settlement of $2.1M reached at mediation.",
            "date_of_injury": "2023-03-17",
            "client": "Jorge Mendez",
            "contact": "Rosa Mendez",
            "defendants": [("Pacific Coast Properties LLC", "municipality_defendant")],
            "opp_counsel": "Karen Blackwell",
            "judge": "Hon. William Foster",
            "experts": ["Dr. James Harrison"],
        },
    ]

    created_cases = []
    for c in cases_data:
        kwargs = dict(
            case_name=c["case_name"],
            status=c["status"],
            case_summary=c.get("case_summary"),
            date_of_injury=c.get("date_of_injury"),
            short_name=c.get("short_name"),
            result=c.get("result"),
        )
        if c.get("trial_date"):
            kwargs["trial_date"] = c["trial_date"]
        case = db.create_case(**kwargs)
        case_id = case["id"]
        db.update_case(case_id, feature_toggles={
            "tasks": True, "events": True, "financials": True, "costs": True,
        })
        created_cases.append({"id": case_id, "name": c["case_name"], "short": c["short_name"], "data": c})

        client = find_person(c["client"])
        if client:
            db.assign_person_to_case(case_id, client["id"], role_map["plaintiff"], is_primary=True)

        if c.get("decedent"):
            dec = find_person(c["decedent"])
            if dec:
                db.assign_person_to_case(case_id, dec["id"], role_map["decedent"])

        if c.get("contact"):
            con = find_person(c["contact"])
            if con:
                db.assign_person_to_case(case_id, con["id"], role_map["contact"])

        for d_name, d_role in c.get("defendants", []):
            defendant = find_person(d_name)
            if defendant:
                db.assign_person_to_case(case_id, defendant["id"], role_map[d_role])

        if c.get("opp_counsel"):
            opp = find_person(c["opp_counsel"])
            if opp:
                db.assign_person_to_case(case_id, opp["id"], role_map["opposing_counsel"],
                                         attributes=opp.get("attributes"))

        if c.get("co_counsel"):
            cc = find_person(c["co_counsel"])
            if cc:
                db.assign_person_to_case(case_id, cc["id"], role_map["co_counsel"],
                                         attributes=cc.get("attributes"))

        for e_name in c.get("experts", []):
            expert = find_person(e_name)
            if expert:
                db.assign_person_to_case(case_id, expert["id"], role_map["plaintiff_expert"],
                                         attributes=expert.get("attributes"))

    def find_case(name):
        for c in created_cases:
            if name in c["name"] or name == c["short"]:
                return c["id"]
        return None

    # ========== ATTORNEY & PARALEGAL ASSIGNMENTS ==========
    print("  Assigning attorneys and paralegals to cases...")

    # user_ids already populated from user creation above
    user_email_to_id = user_ids

    case_attorney_assignments = [
        ("Martinez", "cmayne@example.com"),
        ("Wilson", "cmayne@example.com"),
        ("Wilson", "evalenzuela@example.com"),
        ("Nguyen", "cmayne@example.com"),
        ("Nguyen", "hlee@example.com"),
        ("Thompson", "hlee@example.com"),
        ("Chen", "rvalentine@example.com"),
        ("O'Brien", "blevine@example.com"),
        ("Reyes", "cmayne@example.com"),
        ("Reyes", "msincich@example.com"),
        ("Brooks", "evalenzuela@example.com"),
        ("Fontana", "hlee@example.com"),
        ("Okafor", "bjohnson@example.com"),
        ("Gutierrez", "rvalentine@example.com"),
        ("Holt", "msincich@example.com"),
        ("Tran", "blevine@example.com"),
        ("Washington", "cmayne@example.com"),
        ("Washington", "msincich@example.com"),
        ("Mendez", "evalenzuela@example.com"),
    ]

    for case_name, email in case_attorney_assignments:
        case_id = find_case(case_name)
        user_id = user_email_to_id.get(email)
        if case_id and user_id:
            db.assign_attorney_to_case(case_id, user_id)

    # Paralegal assignments follow attorney-paralegal pairings:
    #   Cooper Mayne / Renee Valentine -> Darci Gilbert
    #   Eric Valenzuela / Marcel Sincich / Brendan Johnson -> Leslie DeLeon
    #   Hang Lee / Ben Levine -> Santiago Laurel
    attorney_to_paralegal = {
        "cmayne@example.com": "dgilbert@example.com",
        "rvalentine@example.com": "dgilbert@example.com",
        "evalenzuela@example.com": "ldeleon@example.com",
        "msincich@example.com": "ldeleon@example.com",
        "bjohnson@example.com": "ldeleon@example.com",
        "hlee@example.com": "slaurel@example.com",
        "blevine@example.com": "slaurel@example.com",
    }

    assigned_paralegals = {}  # case_short -> set of paralegal emails (avoid duplicates)
    for case_name, atty_email in case_attorney_assignments:
        para_email = attorney_to_paralegal.get(atty_email)
        if not para_email:
            continue
        key = case_name
        if key not in assigned_paralegals:
            assigned_paralegals[key] = set()
        if para_email not in assigned_paralegals[key]:
            assigned_paralegals[key].add(para_email)
            case_id = find_case(case_name)
            para_id = user_email_to_id.get(para_email)
            if case_id and para_id:
                db.assign_paralegal_to_case(case_id, para_id)

    # ========== PROCEEDINGS ==========
    print("  Creating proceedings...")

    proceedings_data = [
        {"case": "Martinez", "case_number": "2:24-cv-01234-PAC", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Patricia Collins", "is_primary": True},
        {"case": "Wilson", "case_number": "23STCV45678", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. Robert Takahashi", "is_primary": True},
        {"case": "Nguyen", "case_number": "22STCV34567", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. William Foster", "is_primary": True},
        {"case": "Thompson", "case_number": "2:24-cv-05678-MLS", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Maria Santos", "is_primary": True},
        {"case": "Chen", "case_number": "23STCV12345", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. Robert Takahashi", "is_primary": True},
        {"case": "O'Brien", "case_number": "21STCV09876", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. William Foster", "is_primary": True},
        {"case": "Reyes", "case_number": "2:24-cv-08901-CP", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Catherine Perez", "is_primary": True},
        {"case": "Brooks", "case_number": "24STCV11223", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. David Yoon", "is_primary": True},
        {"case": "Okafor", "case_number": "24STCV33445", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. Robert Takahashi", "is_primary": True},
        {"case": "Holt", "case_number": "2:25-cv-00123-PAC", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Patricia Collins", "is_primary": True},
        {"case": "Tran", "case_number": "22STCV55667", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. David Yoon", "is_primary": True},
        {"case": "Washington", "case_number": "2:23-cv-04567-CP", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Catherine Perez", "is_primary": True},
        {"case": "Mendez", "case_number": "24STCV22334", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. William Foster", "is_primary": True},
    ]

    created_proceedings = []
    for p in proceedings_data:
        case_id = find_case(p["case"])
        jurisdiction_id = jurisdiction_map.get(p["jurisdiction"])
        judge_id = find_judge(p["judge"]) if p.get("judge") else None

        if case_id and jurisdiction_id:
            proceeding = db.add_proceeding(
                case_id=case_id,
                case_number=p["case_number"],
                jurisdiction_id=jurisdiction_id,
                is_primary=p.get("is_primary", False)
            )
            created_proceedings.append(proceeding)

            if judge_id and proceeding:
                db.add_judge_to_proceeding(
                    proceeding_id=proceeding["id"],
                    judge_id=judge_id,
                    role="Judge"
                )

    # ========== EVENTS ==========
    print("  Creating events...")

    events_data = [
        # Martinez
        {"case": "Martinez", "date": (today + timedelta(days=14)).isoformat(), "description": "Discovery cutoff",
         "calculation_note": "Per scheduling order", "starred": True},
        {"case": "Martinez", "date": (today + timedelta(days=21)).isoformat(), "description": "Expert disclosure deadline",
         "calculation_note": "30 days before expert discovery cutoff"},
        {"case": "Martinez", "date": (today + timedelta(days=45)).isoformat(), "description": "Deposition of Officer Smith",
         "time": "10:00", "location": "City Attorney's Office, 200 N Main St"},
        {"case": "Martinez", "date": (today + timedelta(days=90)).isoformat(), "description": "MSJ hearing",
         "time": "09:00", "location": "Courtroom 8A, Roybal Federal Building", "starred": True},

        # Wilson
        {"case": "Wilson", "date": (today + timedelta(days=7)).isoformat(), "description": "Expert deposition - Dr. Mitchell",
         "time": "09:30", "location": "Veritext, 707 Wilshire Blvd"},
        {"case": "Wilson", "date": (today + timedelta(days=30)).isoformat(), "description": "Mediation",
         "time": "09:00", "location": "JAMS, 555 W 5th St", "starred": True},
        {"case": "Wilson", "date": (today + timedelta(days=60)).isoformat(), "description": "Trial",
         "time": "08:30", "location": "Dept 312, Stanley Mosk Courthouse", "starred": True},

        # Nguyen
        {"case": "Nguyen", "date": (today + timedelta(days=5)).isoformat(), "description": "MSJ opposition due", "starred": True},
        {"case": "Nguyen", "date": (today + timedelta(days=21)).isoformat(), "description": "MSJ hearing",
         "time": "10:30", "location": "Dept 504, Stanley Mosk Courthouse", "starred": True},
        {"case": "Nguyen", "date": (today + timedelta(days=75)).isoformat(), "description": "Final Status Conference",
         "time": "08:30", "location": "Dept 504"},
        {"case": "Nguyen", "date": (today + timedelta(days=90)).isoformat(), "description": "Trial",
         "time": "09:00", "location": "Dept 504, Stanley Mosk Courthouse", "starred": True},

        # Thompson
        {"case": "Thompson", "date": (today + timedelta(days=10)).isoformat(), "description": "Defendant's Answer due"},
        {"case": "Thompson", "date": (today + timedelta(days=45)).isoformat(), "description": "Rule 26(f) Conference", "time": "10:00"},

        # Chen
        {"case": "Chen", "date": (today + timedelta(days=3)).isoformat(), "description": "Settlement docs due to defense"},
        {"case": "Chen", "date": (today + timedelta(days=30)).isoformat(), "description": "Settlement funding deadline"},

        # Reyes
        {"case": "Reyes", "date": (today + timedelta(days=10)).isoformat(), "description": "Deposition of Angela Reyes",
         "time": "10:00", "location": "Galipo Law Offices"},
        {"case": "Reyes", "date": (today + timedelta(days=25)).isoformat(), "description": "PMK deposition - LAPD use of force",
         "time": "09:30", "location": "City Attorney's Office"},
        {"case": "Reyes", "date": (today + timedelta(days=60)).isoformat(), "description": "Expert disclosure deadline", "starred": True},

        # Brooks
        {"case": "Brooks", "date": (today + timedelta(days=12)).isoformat(), "description": "Defense expert deposition - Dr. Gomez",
         "time": "10:00", "location": "Lewis Brisbois, 633 W 5th St"},
        {"case": "Brooks", "date": (today + timedelta(days=40)).isoformat(), "description": "Mediation",
         "time": "09:00", "location": "First Mediation, 1801 Century Park E", "starred": True},

        # Okafor
        {"case": "Okafor", "date": (today + timedelta(days=8)).isoformat(), "description": "Written discovery responses due"},
        {"case": "Okafor", "date": (today + timedelta(days=35)).isoformat(), "description": "Deposition of Uber driver",
         "time": "10:00", "location": "Blackwell & Park LLP"},

        # Holt
        {"case": "Holt", "date": (today + timedelta(days=18)).isoformat(), "description": "Pitchess motion hearing",
         "time": "09:00", "location": "Courtroom 8A, Roybal Federal Building", "starred": True},
        {"case": "Holt", "date": (today + timedelta(days=50)).isoformat(), "description": "Deposition of Sgt. Wells",
         "time": "10:00", "location": "County Counsel's Office"},

        # Washington - Trial imminent
        {"case": "Washington", "date": (today + timedelta(days=7)).isoformat(), "description": "Final pretrial conference",
         "time": "10:00", "location": "Courtroom 12C, Roybal Federal Building", "starred": True},
        {"case": "Washington", "date": (today + timedelta(days=14)).isoformat(), "description": "Trial begins",
         "time": "09:00", "location": "Courtroom 12C, Roybal Federal Building", "starred": True},

        # Mendez
        {"case": "Mendez", "date": (today + timedelta(days=5)).isoformat(), "description": "Settlement conference with court",
         "time": "14:00", "location": "Dept 504", "starred": True},
        {"case": "Mendez", "date": (today + timedelta(days=20)).isoformat(), "description": "Settlement documents deadline"},

        # Fontana
        {"case": "Fontana", "date": (today + timedelta(days=30)).isoformat(), "description": "CMC hearing",
         "time": "08:30", "location": "Dept 219"},

        # Gutierrez - Pre-claim deadlines
        {"case": "Gutierrez", "date": (today + timedelta(days=15)).isoformat(), "description": "Government claim filing deadline", "starred": True},
    ]

    for e in events_data:
        case_id = find_case(e["case"])
        if case_id:
            db.add_event(
                case_id=case_id,
                date=e["date"],
                description=e["description"],
                time=e.get("time"),
                location=e.get("location"),
                calculation_note=e.get("calculation_note"),
                starred=e.get("starred", False)
            )

    # ========== TASKS ==========
    print("  Creating tasks...")

    tasks_data = [
        # Martinez
        {"case": "Martinez", "description": "Draft discovery responses", "urgency": "Urgent", "due_date": (today + timedelta(days=7)).isoformat()},
        {"case": "Martinez", "description": "Prepare Officer Smith depo outline", "urgency": "High", "due_date": (today + timedelta(days=35)).isoformat()},
        {"case": "Martinez", "description": "Request body cam footage", "urgency": "High", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Martinez", "description": "Review medical records from UCLA", "urgency": "Medium", "status": "Active"},
        {"case": "Martinez", "description": "Draft MSJ opposition brief", "urgency": "Urgent", "due_date": (today + timedelta(days=60)).isoformat()},
        {"case": "Martinez", "description": "File complaint", "urgency": "Medium", "status": "Done", "completion_date": (today - timedelta(days=60)).isoformat()},

        # Wilson
        {"case": "Wilson", "description": "Finalize Dr. Mitchell expert report", "urgency": "Urgent", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Wilson", "description": "Prepare mediation brief", "urgency": "High", "due_date": (today + timedelta(days=20)).isoformat()},
        {"case": "Wilson", "description": "Review defendant's expert reports", "urgency": "High", "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Wilson", "description": "Prepare trial exhibits", "urgency": "Medium", "due_date": (today + timedelta(days=45)).isoformat()},
        {"case": "Wilson", "description": "Complete written discovery", "urgency": "High", "status": "Done", "completion_date": (today - timedelta(days=30)).isoformat()},

        # Nguyen
        {"case": "Nguyen", "description": "Draft MSJ opposition", "urgency": "Urgent", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Nguyen", "description": "Compile evidence for opposition", "urgency": "Urgent", "due_date": (today + timedelta(days=2)).isoformat()},
        {"case": "Nguyen", "description": "Prepare trial witness list", "urgency": "Medium", "due_date": (today + timedelta(days=60)).isoformat()},
        {"case": "Nguyen", "description": "Request interpreter for trial", "urgency": "Medium", "due_date": (today + timedelta(days=45)).isoformat()},
        {"case": "Nguyen", "description": "Complete all depositions", "urgency": "High", "status": "Done", "completion_date": (today - timedelta(days=45)).isoformat()},

        # Thompson
        {"case": "Thompson", "description": "Review defendant's answer when filed", "urgency": "Medium", "due_date": (today + timedelta(days=15)).isoformat()},
        {"case": "Thompson", "description": "Draft initial discovery requests", "urgency": "Medium", "due_date": (today + timedelta(days=30)).isoformat()},
        {"case": "Thompson", "description": "Request jail records", "urgency": "High", "due_date": (today + timedelta(days=5)).isoformat()},

        # Chen
        {"case": "Chen", "description": "Review settlement agreement", "urgency": "Urgent", "due_date": (today + timedelta(days=1)).isoformat()},
        {"case": "Chen", "description": "Calculate lien reductions", "urgency": "High", "due_date": (today + timedelta(days=7)).isoformat()},
        {"case": "Chen", "description": "Prepare disbursement sheet", "urgency": "High", "due_date": (today + timedelta(days=14)).isoformat()},

        # Davis
        {"case": "Davis", "description": "Schedule client intake meeting", "urgency": "High", "due_date": (today + timedelta(days=2)).isoformat()},
        {"case": "Davis", "description": "Request police report", "urgency": "High", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Davis", "description": "Send records authorization to client", "urgency": "Medium", "due_date": (today + timedelta(days=1)).isoformat()},
        {"case": "Davis", "description": "Research statute of limitations", "urgency": "Urgent", "due_date": (today + timedelta(days=1)).isoformat()},

        # Kim
        {"case": "Kim", "description": "Order traffic camera footage", "urgency": "High", "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Kim", "description": "Interview witnesses", "urgency": "High", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Kim", "description": "File police report request", "urgency": "Medium", "status": "Done", "completion_date": (today - timedelta(days=2)).isoformat()},

        # Reyes
        {"case": "Reyes", "description": "Prepare Angela Reyes for deposition", "urgency": "Urgent", "due_date": (today + timedelta(days=7)).isoformat()},
        {"case": "Reyes", "description": "Subpoena LAPD internal affairs file", "urgency": "High", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Reyes", "description": "Review body cam footage", "urgency": "High", "status": "Active"},
        {"case": "Reyes", "description": "Draft PMK deposition outline (use of force)", "urgency": "High", "due_date": (today + timedelta(days=20)).isoformat()},
        {"case": "Reyes", "description": "Obtain autopsy report", "urgency": "Medium", "status": "Done", "completion_date": (today - timedelta(days=30)).isoformat()},

        # Brooks
        {"case": "Brooks", "description": "Prepare for defense expert deposition", "urgency": "High", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Brooks", "description": "Draft mediation brief", "urgency": "High", "due_date": (today + timedelta(days=30)).isoformat()},
        {"case": "Brooks", "description": "Collect medical bills for demand", "urgency": "Medium", "status": "Active"},

        # Fontana
        {"case": "Fontana", "description": "Serve complaint on City of Pasadena", "urgency": "High", "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Fontana", "description": "Photograph sidewalk defect", "urgency": "Medium", "status": "Done", "completion_date": (today - timedelta(days=10)).isoformat()},

        # Okafor
        {"case": "Okafor", "description": "Draft discovery responses", "urgency": "Urgent", "due_date": (today + timedelta(days=6)).isoformat()},
        {"case": "Okafor", "description": "Subpoena Uber trip records", "urgency": "High", "due_date": (today + timedelta(days=15)).isoformat()},
        {"case": "Okafor", "description": "Request police accident report", "urgency": "Medium", "status": "Done", "completion_date": (today - timedelta(days=20)).isoformat()},

        # Gutierrez
        {"case": "Gutierrez", "description": "File government tort claim", "urgency": "Urgent", "due_date": (today + timedelta(days=12)).isoformat()},
        {"case": "Gutierrez", "description": "Obtain school incident report", "urgency": "High", "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Gutierrez", "description": "Schedule child psych evaluation", "urgency": "Medium", "due_date": (today + timedelta(days=20)).isoformat()},

        # Holt
        {"case": "Holt", "description": "Draft Pitchess motion", "urgency": "Urgent", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Holt", "description": "Prepare deposition outline for Sgt. Wells", "urgency": "High", "due_date": (today + timedelta(days=40)).isoformat()},
        {"case": "Holt", "description": "Request jail medical records", "urgency": "High", "status": "Active"},

        # Washington - Trial prep
        {"case": "Washington", "description": "Finalize jury instructions", "urgency": "Urgent", "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Washington", "description": "Prepare opening statement", "urgency": "Urgent", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Washington", "description": "Organize trial exhibits", "urgency": "Urgent", "due_date": (today + timedelta(days=7)).isoformat()},
        {"case": "Washington", "description": "Confirm witness availability", "urgency": "High", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Washington", "description": "File motions in limine", "urgency": "High", "status": "Done", "completion_date": (today - timedelta(days=7)).isoformat()},

        # Mendez
        {"case": "Mendez", "description": "Review settlement agreement", "urgency": "Urgent", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Mendez", "description": "Calculate lien payoffs", "urgency": "High", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Mendez", "description": "Prepare disbursement statement", "urgency": "High", "due_date": (today + timedelta(days=15)).isoformat()},

        # Petrov
        {"case": "Petrov", "description": "Send retainer agreement to client", "urgency": "High", "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Petrov", "description": "Request incident report from store", "urgency": "Medium", "due_date": (today + timedelta(days=7)).isoformat()},

        # Tran - closed but some Done tasks
        {"case": "Tran", "description": "Finalize disbursement", "urgency": "High", "status": "Done", "completion_date": (today - timedelta(days=90)).isoformat()},
    ]

    for t in tasks_data:
        case_id = find_case(t["case"])
        if case_id:
            db.add_task(
                case_id=case_id,
                description=t["description"],
                urgency=t.get("urgency", "Medium"),
                due_date=t.get("due_date"),
                status=t.get("status", "Pending")
            )
            if t.get("completion_date"):
                tasks_result = db.get_tasks(case_id=case_id)
                for task in tasks_result.get("tasks", []):
                    if task["description"] == t["description"]:
                        db.update_task_full(task["id"], completion_date=t["completion_date"])
                        break

    # ========== NOTES ==========
    print("  Creating notes...")

    notes_data = [
        {"case": "Martinez", "content": "Client is very cooperative and has good recall of the incident. She mentioned there were bystanders who recorded the incident on their phones - need to track down this footage."},
        {"case": "Martinez", "content": "Defense counsel indicated they may file MSJ on qualified immunity grounds. Need to start researching this issue now."},
        {"case": "Wilson", "content": "Trucking company's insurance policy limit is $1M. May need to explore excess coverage."},
        {"case": "Wilson", "content": "Client has returned to work but on light duty. Lost wages claim is ongoing."},
        {"case": "Nguyen", "content": "Client's English is limited - will need Vietnamese interpreter for all proceedings. Daughter (Kim Nguyen, 626-555-8888) can help with informal communications."},
        {"case": "Nguyen", "content": "MTA has surveillance video of the accident. Their expert claims bus driver was not at fault - need to rebut this with our own accident reconstruction."},
        {"case": "Thompson", "content": "Client has prior arrest record (2015 DUI) - need to address this proactively if it comes up."},
        {"case": "Chen", "content": "Settlement reached at mediation for $750,000. Defense is handling through their insurance carrier (Doctors Company)."},
        {"case": "Chen", "content": "Medicare lien of approximately $45,000 will need to be resolved before disbursement."},
        {"case": "Davis", "content": "Client referred by Maria Martinez (another client). Incident occurred outside a nightclub in Hollywood. Potential witnesses include bouncer and other patrons."},
        {"case": "Kim", "content": "Hit and run occurred at intersection of Wilshire and Western. City traffic camera may have captured the incident. Have requested footage from LADOT."},
        {"case": "Reyes", "content": "LAPD released minimal information citing ongoing internal investigation. Filed CPRA request. Co-counsel Amanda Foster specializes in police shooting cases."},
        {"case": "Reyes", "content": "Decedent Frank Reyes had no criminal history. Was having a mental health episode. Neighbor called for welfare check, not police."},
        {"case": "Brooks", "content": "Store manager acknowledged no wet floor signs were out. This is captured in the incident report. Strong liability case."},
        {"case": "Okafor", "content": "Uber's insurance has $1M per-incident limit. Driver had personal policy as well. Client's nerve damage may require multiple surgeries."},
        {"case": "Holt", "content": "Three other inmates witnessed the beating. Two have provided declarations. Third was transferred and we're trying to locate him."},
        {"case": "Washington", "content": "Strong case for trial. City offered $800K but client rejected. We believe jury will award significantly more given the permanent nerve damage."},
        {"case": "Washington", "content": "Co-counsel Amanda Foster will handle cross-examination of the officers. We handle damages witnesses and closing."},
        {"case": "Mendez", "content": "Property management company had three prior complaints about blind spot in parking structure. HOA meeting minutes document these complaints."},
        {"case": "Gutierrez", "content": "School has history of supervision complaints. LAUSD inspector general report from 2024 flagged staffing shortages."},
        {"case": "Fontana", "content": "City of Pasadena was on notice - 311 complaint was filed about the sidewalk 8 months before the incident."},
    ]

    for n in notes_data:
        case_id = find_case(n["case"])
        if case_id:
            db.add_note(case_id, n["content"])

    # ========== INTAKES ==========
    print("  Creating intakes...")

    intakes_data = [
        {"name": "Roberto Salazar", "phone": "323-555-8001", "email": "rsalazar@email.com",
         "case_type": "Excessive Force", "incident_date": "2025-04-15", "location": "Downtown LA",
         "incident_description": "Stopped by LAPD on Spring St. Officers pulled him from vehicle and slammed him on ground. Bystander video exists.",
         "injury_description": "Dislocated shoulder, facial lacerations, back pain",
         "status": "New"},
        {"name": "Karen Wu", "phone": "626-555-8002", "email": "kwu@gmail.com",
         "case_type": "Medical Malpractice", "incident_date": "2025-03-20",
         "incident_description": "Went to ER with chest pain, was diagnosed with anxiety and sent home. Had heart attack next day requiring emergency surgery.",
         "injury_description": "Heart attack, cardiac damage, emergency triple bypass",
         "status": "Dave Review", "ai_rating": 8, "ai_summary": "Strong case. ER misdiagnosis with severe consequences. Clear deviation from standard of care."},
        {"name": "Marcus Johnson", "phone": "310-555-8003",
         "case_type": "Auto Accident", "incident_date": "2025-05-01", "location": "PCH near Malibu",
         "incident_description": "Rear-ended by delivery truck while stopped at red light. Truck driver was on phone.",
         "injury_description": "Neck and back pain, headaches",
         "status": "Needs Follow-Up"},
        {"name": "Priya Sharma", "phone": "818-555-8004", "email": "priya.sharma@outlook.com",
         "case_type": "Slip and Fall", "incident_date": "2025-04-28", "location": "Costco, Burbank",
         "incident_description": "Slipped on spilled liquid in produce section. No wet floor signs.",
         "injury_description": "Broken wrist, bruised tailbone",
         "status": "Atty Review", "ai_rating": 6, "ai_summary": "Moderate case. Premises liability with potential notice issue. Need to confirm no wet floor signs via surveillance."},
        {"name": "Anthony Flores", "phone": "562-555-8005",
         "case_type": "Dog Bite", "incident_date": "2025-05-10", "location": "Downey, CA",
         "incident_description": "Neighbor's pit bull escaped yard and attacked client while he was walking. Dog has history of aggression.",
         "injury_description": "Deep lacerations on arms and legs, nerve damage in left hand",
         "status": "Needs Retainer"},
        {"name": "Joyce Park", "phone": "213-555-8006", "email": "jpark@yahoo.com",
         "case_type": "Wrongful Death", "incident_date": "2025-02-28",
         "incident_description": "Husband died in construction accident. Scaffolding collapsed at job site. Employer had prior OSHA violations.",
         "injury_description": "Death - survived by wife and two minor children",
         "status": "Awaiting PC", "ai_rating": 9, "ai_summary": "High-value wrongful death. Construction site negligence with OSHA violation history. Employer and general contractor both potentially liable.",
         "referral_name": "Tom Nakashima", "referral_org": "Nakashima & Associates"},
        {"name": "Daniel Green", "phone": "714-555-8007",
         "case_type": "Police Misconduct", "incident_date": "2025-04-05", "location": "Santa Ana",
         "incident_description": "Client alleges false arrest during protest. Held for 12 hours without charges.",
         "injury_description": "Wrist injuries from tight handcuffs, emotional distress",
         "status": "Needs Rejection Letter",
         "notes": "Statute of limitations issue - incident was with Santa Ana PD, outside our typical practice area."},
        {"name": "Lisa Chang", "phone": "949-555-8008", "email": "lchang@icloud.com",
         "case_type": "Auto Accident", "incident_date": "2025-05-15", "location": "405 Freeway, Irvine",
         "incident_description": "Multi-car pileup. Client was third car in chain reaction. Appears first car cut across lanes.",
         "injury_description": "Whiplash, shoulder pain",
         "status": "Rejection Letter Sent",
         "notes": "Minor injuries, liability unclear with multi-car scenario. Referred to Adamson & Associates."},
        {"name": "Omar Hassan", "phone": "323-555-8009", "email": "ohassan@gmail.com",
         "case_type": "Excessive Force", "incident_date": "2025-05-08", "location": "Skid Row, LA",
         "incident_description": "LAPD officers used taser on client multiple times during mental health crisis. Client was unarmed and not aggressive.",
         "injury_description": "Taser burns, fall injuries, aggravated PTSD",
         "status": "Retainer Signed"},
        {"name": "Margaret Kelly", "phone": "818-555-8010", "email": "mkelly@hotmail.com",
         "case_type": "Nursing Home Neglect", "incident_date": "2025-03-01",
         "contact_relationship": "Daughter calling on behalf of mother",
         "incident_description": "Mother developed severe bedsores in nursing home. Staff failed to reposition her regularly despite care plan.",
         "injury_description": "Stage 4 pressure ulcers, infection requiring hospitalization",
         "status": "Dave Review", "ai_rating": 7, "ai_summary": "Nursing home neglect with documented care plan violations. Strong case if medical records support timeline."},
    ]

    for intake in intakes_data:
        status = intake.pop("status", "New")
        ai_rating = intake.pop("ai_rating", None)
        ai_summary = intake.pop("ai_summary", None)
        result = db.create_intake(**intake)
        if status != "New" or ai_rating or ai_summary:
            updates = {}
            if status != "New":
                updates["status"] = status
            if ai_rating:
                updates["ai_rating"] = ai_rating
            if ai_summary:
                updates["ai_summary"] = ai_summary
            db.update_intake(result["id"], **updates)

    # ========== PAYEES ==========
    print("  Creating payees...")

    payees = {}
    payees_data = [
        {"name": "Veritext Court Reporters", "address": "707 Wilshire Blvd, Suite 3600, Los Angeles, CA 90017"},
        {"name": "UCLA Medical Records", "address": "757 Westwood Plaza, Los Angeles, CA 90095"},
        {"name": "US District Court - C.D. Cal.", "address": "312 N Spring St, Los Angeles, CA 90012"},
        {"name": "LA Superior Court", "address": "111 N Hill St, Los Angeles, CA 90012"},
        {"name": "Mitchell Biomechanics Group", "pay_to": "Dr. Sarah Mitchell", "address": "4660 La Jolla Village Dr, San Diego, CA 92122"},
        {"name": "Harrison Economics", "pay_to": "Dr. James Harrison", "address": "801 S Figueroa St, Suite 300, Los Angeles, CA 90017"},
        {"name": "Southern California Neurology", "pay_to": "Dr. Linda Park", "address": "150 N Robertson Blvd, Beverly Hills, CA 90211"},
        {"name": "JAMS", "address": "555 W 5th St, 32nd Floor, Los Angeles, CA 90013"},
        {"name": "Cedars-Sinai Medical Records", "address": "8700 Beverly Blvd, Los Angeles, CA 90048"},
        {"name": "LAPD Records Division", "address": "100 W 1st St, Los Angeles, CA 90012"},
        {"name": "Gomez Radiology Associates", "pay_to": "Dr. Patricia Gomez", "address": "6801 Park Terrace, Los Angeles, CA 90045"},
        {"name": "First Mediation", "pay_to": "Jeffrey Krivis", "address": "1801 Century Park East, Suite 2400, Los Angeles, CA 90067"},
        {"name": "Cedars-Sinai Medical Center (Lien)", "address": "8700 Beverly Blvd, Los Angeles, CA 90048"},
        {"name": "Medicare", "address": "PO Box 138899, Oklahoma City, OK 73113"},
        {"name": "Health Net", "address": "PO Box 9103, Van Nuys, CA 91409"},
        {"name": "Kaiser Permanente (Lien)", "address": "393 E Walnut St, Pasadena, CA 91188"},
    ]

    for p in payees_data:
        result = db.create_payee(**p)
        payees[p["name"]] = result["id"]

    # ========== INVOICES ==========
    print("  Creating invoices...")

    invoices_data = [
        # Martinez - active case costs
        {"case": "Martinez", "payee": "US District Court - C.D. Cal.", "amount": 402.00, "description": "Filing fee - complaint", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=180)).isoformat(), "paid_date": (today - timedelta(days=180)).isoformat()},
        {"case": "Martinez", "payee": "UCLA Medical Records", "amount": 185.50, "description": "Medical records request", "category": "Medical Records", "status": "paid", "date": (today - timedelta(days=120)).isoformat(), "paid_date": (today - timedelta(days=115)).isoformat()},
        {"case": "Martinez", "payee": "Veritext Court Reporters", "amount": 2450.00, "description": "Deposition transcript - Officer Smith", "category": "Court Reporter", "status": "unpaid", "date": (today - timedelta(days=5)).isoformat(), "due_date": (today + timedelta(days=25)).isoformat()},
        {"case": "Martinez", "payee": "Mitchell Biomechanics Group", "amount": 7500.00, "description": "Expert report - biomechanics analysis", "category": "Expert Fees", "status": "unpaid", "date": (today - timedelta(days=15)).isoformat(), "due_date": (today + timedelta(days=15)).isoformat()},

        # Wilson
        {"case": "Wilson", "payee": "LA Superior Court", "amount": 435.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=365)).isoformat(), "paid_date": (today - timedelta(days=365)).isoformat()},
        {"case": "Wilson", "payee": "Mitchell Biomechanics Group", "amount": 12000.00, "description": "Expert report + deposition prep", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=30)).isoformat(), "paid_date": (today - timedelta(days=25)).isoformat()},
        {"case": "Wilson", "payee": "Harrison Economics", "amount": 5000.00, "description": "Economic damages report", "category": "Expert Fees", "status": "unpaid", "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Wilson", "payee": "JAMS", "amount": 4500.00, "description": "Mediation half-day fee", "category": "Mediation", "status": "unpaid", "due_date": (today + timedelta(days=30)).isoformat()},

        # Nguyen
        {"case": "Nguyen", "payee": "LA Superior Court", "amount": 435.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=500)).isoformat(), "paid_date": (today - timedelta(days=500)).isoformat()},
        {"case": "Nguyen", "payee": "Southern California Neurology", "amount": 8500.00, "description": "Neurological evaluation + report", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=60)).isoformat(), "paid_date": (today - timedelta(days=55)).isoformat()},
        {"case": "Nguyen", "payee": "Veritext Court Reporters", "amount": 3200.00, "description": "MTA PMK deposition transcript", "category": "Court Reporter", "status": "paid", "date": (today - timedelta(days=90)).isoformat(), "paid_date": (today - timedelta(days=80)).isoformat()},

        # Reyes
        {"case": "Reyes", "payee": "US District Court - C.D. Cal.", "amount": 402.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=90)).isoformat(), "paid_date": (today - timedelta(days=90)).isoformat()},
        {"case": "Reyes", "payee": "LAPD Records Division", "amount": 350.00, "description": "CPRA records request", "category": "Records", "status": "paid", "date": (today - timedelta(days=60)).isoformat(), "paid_date": (today - timedelta(days=55)).isoformat()},
        {"case": "Reyes", "payee": "Cedars-Sinai Medical Records", "amount": 225.00, "description": "Decedent hospital records", "category": "Medical Records", "status": "paid", "date": (today - timedelta(days=75)).isoformat(), "paid_date": (today - timedelta(days=70)).isoformat()},

        # Brooks
        {"case": "Brooks", "payee": "LA Superior Court", "amount": 435.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=200)).isoformat(), "paid_date": (today - timedelta(days=200)).isoformat()},
        {"case": "Brooks", "payee": "Gomez Radiology Associates", "amount": 4200.00, "description": "Radiology review + report", "category": "Expert Fees", "status": "unpaid", "due_date": (today + timedelta(days=20)).isoformat()},
        {"case": "Brooks", "payee": "First Mediation", "amount": 4500.00, "description": "Mediation half-day", "category": "Mediation", "status": "unpaid", "due_date": (today + timedelta(days=40)).isoformat()},

        # Holt
        {"case": "Holt", "payee": "US District Court - C.D. Cal.", "amount": 402.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=45)).isoformat(), "paid_date": (today - timedelta(days=45)).isoformat()},

        # Washington - Trial prep costs
        {"case": "Washington", "payee": "US District Court - C.D. Cal.", "amount": 402.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=700)).isoformat(), "paid_date": (today - timedelta(days=700)).isoformat()},
        {"case": "Washington", "payee": "Mitchell Biomechanics Group", "amount": 15000.00, "description": "Expert report + depo + trial prep", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=40)).isoformat(), "paid_date": (today - timedelta(days=35)).isoformat()},
        {"case": "Washington", "payee": "Southern California Neurology", "amount": 9500.00, "description": "Neurology eval + trial testimony prep", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=30)).isoformat(), "paid_date": (today - timedelta(days=25)).isoformat()},
        {"case": "Washington", "payee": "Harrison Economics", "amount": 6000.00, "description": "Economics report + trial testimony", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=25)).isoformat(), "paid_date": (today - timedelta(days=20)).isoformat()},
        {"case": "Washington", "payee": "Veritext Court Reporters", "amount": 8900.00, "description": "Multiple deposition transcripts", "category": "Court Reporter", "status": "paid", "date": (today - timedelta(days=100)).isoformat(), "paid_date": (today - timedelta(days=90)).isoformat()},

        # O'Brien - closed case, all paid
        {"case": "O'Brien", "payee": "LA Superior Court", "amount": 435.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=900)).isoformat(), "paid_date": (today - timedelta(days=900)).isoformat()},
        {"case": "O'Brien", "payee": "Mitchell Biomechanics Group", "amount": 10000.00, "description": "Expert fees (full engagement)", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=400)).isoformat(), "paid_date": (today - timedelta(days=395)).isoformat()},
        {"case": "O'Brien", "payee": "JAMS", "amount": 9000.00, "description": "Mediation full day", "category": "Mediation", "status": "paid", "date": (today - timedelta(days=200)).isoformat(), "paid_date": (today - timedelta(days=195)).isoformat()},

        # Tran - closed case, all paid
        {"case": "Tran", "payee": "LA Superior Court", "amount": 435.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=600)).isoformat(), "paid_date": (today - timedelta(days=600)).isoformat()},

        # Mendez - settlement pending
        {"case": "Mendez", "payee": "LA Superior Court", "amount": 435.00, "description": "Filing fee", "category": "Filing Fees", "status": "paid", "date": (today - timedelta(days=300)).isoformat(), "paid_date": (today - timedelta(days=300)).isoformat()},
        {"case": "Mendez", "payee": "Harrison Economics", "amount": 5500.00, "description": "Wrongful death damages report", "category": "Expert Fees", "status": "paid", "date": (today - timedelta(days=60)).isoformat(), "paid_date": (today - timedelta(days=55)).isoformat()},
    ]

    for inv in invoices_data:
        case_id = find_case(inv["case"])
        payee_id = payees.get(inv["payee"])
        if case_id:
            db.create_invoice(
                case_id=case_id,
                payee_id=payee_id,
                amount=inv["amount"],
                description=inv.get("description"),
                category=inv.get("category"),
                status=inv.get("status", "unpaid"),
                date=inv.get("date"),
                due_date=inv.get("due_date"),
                paid_date=inv.get("paid_date"),
            )

    # ========== LIENS ==========
    print("  Creating liens...")

    liens_data = [
        # Chen - settlement pending, liens being negotiated
        {"case": "Chen", "payee": "Medicare", "claimed_amount": 45000.00, "negotiated_amount": 22500.00,
         "status": "negotiating", "description": "Medicare lien - hospital and follow-up care"},
        {"case": "Chen", "payee": "Cedars-Sinai Medical Center (Lien)", "claimed_amount": 67000.00, "negotiated_amount": 40000.00,
         "status": "negotiating", "description": "Hospital lien - emergency surgery and 5-day stay"},

        # Wilson - active case, liens accruing
        {"case": "Wilson", "payee": "Health Net", "claimed_amount": 85000.00,
         "status": "pending", "description": "Health insurance subrogation - lumbar surgery"},

        # O'Brien - closed case, liens resolved
        {"case": "O'Brien", "payee": "Medicare", "claimed_amount": 32000.00, "negotiated_amount": 16000.00,
         "status": "paid", "description": "Medicare lien - resolved at 50%", "paid_date": (today - timedelta(days=150)).isoformat(), "check_number": "10234"},
        {"case": "O'Brien", "payee": "Health Net", "claimed_amount": 55000.00, "negotiated_amount": 27500.00,
         "status": "paid", "description": "Health Net subrogation - resolved at 50%", "paid_date": (today - timedelta(days=150)).isoformat(), "check_number": "10235"},

        # Tran - closed, liens resolved
        {"case": "Tran", "payee": "Kaiser Permanente (Lien)", "claimed_amount": 42000.00, "negotiated_amount": 25000.00,
         "status": "paid", "description": "Kaiser hospital lien", "paid_date": (today - timedelta(days=100)).isoformat(), "check_number": "10289"},

        # Mendez - settlement pending
        {"case": "Mendez", "payee": "Cedars-Sinai Medical Center (Lien)", "claimed_amount": 120000.00,
         "status": "pending", "description": "Hospital lien - emergency treatment"},

        # Nguyen - pre-trial
        {"case": "Nguyen", "payee": "Health Net", "claimed_amount": 95000.00,
         "status": "pending", "description": "Health insurance subrogation - TBI treatment and rehab"},

        # Washington - going to trial
        {"case": "Washington", "payee": "Medicare", "claimed_amount": 38000.00,
         "status": "pending", "description": "Medicare lien - ongoing treatment for nerve damage"},
    ]

    for lien in liens_data:
        case_id = find_case(lien["case"])
        payee_id = payees.get(lien["payee"])
        if case_id:
            db.create_lien(
                case_id=case_id,
                payee_id=payee_id,
                claimed_amount=lien["claimed_amount"],
                negotiated_amount=lien.get("negotiated_amount"),
                status=lien.get("status", "pending"),
                description=lien.get("description"),
                paid_date=lien.get("paid_date"),
                check_number=lien.get("check_number"),
            )

    # ========== FINANCIAL RECORDS (resolved cases) ==========
    print("  Creating financial records...")

    financials_data = [
        {"case": "O'Brien", "resolution_type": "Settlement", "resolution_date": (today - timedelta(days=180)).isoformat(),
         "gross_recovery": 1200000.00, "costs_advanced": 19435.00, "liens_total": 43500.00, "is_finalized": True},
        {"case": "Tran", "resolution_type": "Settlement", "resolution_date": (today - timedelta(days=120)).isoformat(),
         "gross_recovery": 650000.00, "costs_advanced": 435.00, "liens_total": 25000.00, "is_finalized": True},
    ]

    for fin in financials_data:
        case_id = find_case(fin["case"])
        if case_id:
            db.create_financial(
                case_id=case_id,
                resolution_type=fin.get("resolution_type"),
                resolution_date=fin.get("resolution_date"),
                gross_recovery=fin.get("gross_recovery"),
                costs_advanced=fin.get("costs_advanced"),
                liens_total=fin.get("liens_total"),
                is_finalized=fin.get("is_finalized", False),
            )

    # ========== WEBHOOKS ==========
    print("  Creating webhook logs...")

    import uuid

    webhooks_data = [
        {
            "source": "courtlistener", "event_type": "1",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {"webhook": {"event_type": 1, "version": 2}, "payload": {"results": [{"docket_id": 68547231, "case_name": "Martinez v. City of Los Angeles", "court": "cacd", "docket_number": "2:24-cv-01234-PAC", "description": "ORDER granting Motion for Extension of Time"}]}},
            "headers": {"content-type": "application/json", "user-agent": "CourtListener/2.0"},
            "processing_status": "completed",
        },
        {
            "source": "courtlistener", "event_type": "2",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {"webhook": {"event_type": 2, "version": 2}, "payload": {"alert": {"name": "Police Misconduct - Los Angeles", "query": "police AND misconduct", "rate": "rt"}, "results": [{"caseName": "Davis v. City of Los Angeles", "court": "C.D. Cal.", "snippet": "...alleged excessive force by LAPD officers..."}]}},
            "headers": {"content-type": "application/json", "user-agent": "CourtListener/2.0"},
            "processing_status": "pending",
        },
        {
            "source": "courtlistener", "event_type": "1",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {"webhook": {"event_type": 1, "version": 2}, "payload": {"results": [{"docket_id": 68234567, "case_name": "Nguyen v. Metro Transit Authority", "court": "lasc", "docket_number": "22STCV34567", "description": "MOTION for Summary Judgment filed by Defendant"}]}},
            "headers": {"content-type": "application/json", "user-agent": "CourtListener/2.0"},
            "processing_status": "processing",
        },
        {
            "source": "courtlistener", "event_type": "1",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {"webhook": {"event_type": 1, "version": 2}, "payload": {"results": [{"docket_id": 99999999, "case_name": "Unknown Case", "court": "unknown", "docket_number": "INVALID-123"}]}},
            "headers": {"content-type": "application/json", "user-agent": "CourtListener/2.0"},
            "processing_status": "failed",
            "processing_error": "Could not match docket to any known case in the system",
        },
    ]

    for w in webhooks_data:
        result = db.create_webhook_log(
            source=w["source"],
            payload=w["payload"],
            event_type=w.get("event_type"),
            idempotency_key=w.get("idempotency_key"),
            headers=w.get("headers"),
        )

        if result and w.get("processing_status") != "pending":
            webhook_id = result["id"]
            if w["processing_status"] == "failed":
                db.mark_webhook_failed(webhook_id, w.get("processing_error", "Unknown error"))
            elif w["processing_status"] == "completed":
                db.mark_webhook_completed(webhook_id)
            elif w["processing_status"] == "processing":
                db.mark_webhook_processing(webhook_id)

    # ========== SUMMARY ==========
    print("\nDevelopment data seeded successfully!")
    print(f"  - {len(jurisdictions)} jurisdictions")
    print(f"  - {len(all_roles)} roles")
    print(f"  - {len(db.get_expertise_types())} expertise types")
    print(f"  - {len(persons)} persons created")
    print(f"  - {len(judges)} judges created")
    print(f"  - {len(created_cases)} cases created")
    print(f"  - {len(created_proceedings)} proceedings created")
    print(f"  - {len(events_data)} events created")
    print(f"  - {len(tasks_data)} tasks created")
    print(f"  - {len(notes_data)} notes created")
    print(f"  - {len(intakes_data)} intakes created")
    print(f"  - {len(payees_data)} payees created")
    print(f"  - {len(invoices_data)} invoices created")
    print(f"  - {len(liens_data)} liens created")
    print(f"  - {len(financials_data)} financial records created")
    print(f"  - {len(webhooks_data)} webhook logs created")


if __name__ == "__main__":
    if not os.environ.get("DATABASE_URL"):
        print("ERROR: DATABASE_URL environment variable not set")
        print("Usage: set -a && source .env && set +a && python scripts/seed_dev_data.py")
        exit(1)

    seed_dev_data()
