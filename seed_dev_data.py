#!/usr/bin/env python3
"""
Development Seed Data for Galipo

Run this script to populate the database with realistic mock data for development.

Usage:
    DATABASE_URL="postgresql://..." python seed_dev_data.py

This will add:
- 8 cases at various litigation stages
- 25+ persons (clients, attorneys, judges, experts, defendants)
- Case-person relationships
- Events/deadlines
- Tasks
- Activities
- Notes
"""

import os
import json
from datetime import datetime, timedelta
import random

# Ensure we can import from the project
import database as db

def seed_dev_data():
    """Seed the database with development mock data."""

    print("Seeding development data...")

    # First seed the lookup tables (jurisdictions, person_types, expertise_types)
    print("  Seeding lookup tables...")
    db.seed_db()

    # Get jurisdiction IDs
    jurisdictions = db.get_jurisdictions()
    jurisdiction_map = {j["name"]: j["id"] for j in jurisdictions}

    # ========== PERSONS ==========
    print("  Creating persons...")

    persons = []

    # Clients
    clients_data = [
        {"name": "Maria Elena Martinez", "phones": [{"value": "310-555-1234", "label": "Cell", "primary": True}],
         "emails": [{"value": "maria.martinez@email.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1985-03-15", "preferred_language": "Spanish"}},
        {"name": "James Robert Wilson", "phones": [{"value": "213-555-5678", "label": "Cell", "primary": True}],
         "emails": [{"value": "jwilson@gmail.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1972-08-22"}},
        {"name": "Nguyen Thi Phuong", "phones": [{"value": "626-555-9012", "label": "Cell", "primary": True}],
         "emails": [{"value": "phuong.nguyen@yahoo.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1990-11-08", "preferred_language": "Vietnamese"}},
        {"name": "Robert Charles Thompson", "phones": [{"value": "818-555-3456", "label": "Cell", "primary": True}, {"value": "818-555-3457", "label": "Work", "primary": False}],
         "emails": [{"value": "rthompson@outlook.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1968-05-30"}},
        {"name": "Samantha Lynn Chen", "phones": [{"value": "949-555-7890", "label": "Cell", "primary": True}],
         "emails": [{"value": "samantha.chen@icloud.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1995-01-12"}},
        {"name": "Marcus Anthony Davis", "phones": [{"value": "562-555-2345", "label": "Cell", "primary": True}],
         "emails": [{"value": "mdavis_law@gmail.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1980-07-04"}},
        {"name": "Patricia Ann O'Brien", "phones": [{"value": "714-555-6789", "label": "Cell", "primary": True}],
         "emails": [{"value": "pobrien55@hotmail.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1955-12-20"}},
        {"name": "David Kim", "phones": [{"value": "323-555-0123", "label": "Cell", "primary": True}],
         "emails": [{"value": "david.kim.la@gmail.com", "label": "Personal", "primary": True}],
         "attributes": {"date_of_birth": "1988-09-17"}},
    ]

    for c in clients_data:
        person = db.create_person(
            name=c["name"],
            person_type="client",
            phones=c.get("phones"),
            emails=c.get("emails"),
            attributes=c.get("attributes")
        )
        persons.append({"id": person["id"], "name": c["name"], "type": "client"})

    # Defendants (entities)
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
    ]

    for d in defendants_data:
        person = db.create_person(
            name=d["name"],
            person_type="defendant",
            organization=d.get("organization"),
            phones=d.get("phones"),
            address=d.get("address")
        )
        persons.append({"id": person["id"], "name": d["name"], "type": "defendant"})

    # Opposing Counsel
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
    ]

    for a in opp_counsel_data:
        person = db.create_person(
            name=a["name"],
            person_type="attorney",
            organization=a.get("organization"),
            phones=a.get("phones"),
            emails=a.get("emails"),
            attributes=a.get("attributes")
        )
        persons.append({"id": person["id"], "name": a["name"], "type": "attorney"})

    # Judges
    judges_data = [
        {"name": "Hon. Patricia Collins", "organization": "C.D. Cal.",
         "attributes": {"courtroom_number": "8A", "initials": "PAC", "status": "Active"}},
        {"name": "Hon. Robert Takahashi", "organization": "Los Angeles Superior",
         "attributes": {"courtroom_number": "312", "initials": "RT", "status": "Active"}},
        {"name": "Hon. Maria Santos", "organization": "C.D. Cal.",
         "attributes": {"courtroom_number": "6B", "initials": "MLS", "status": "Active"}},
        {"name": "Hon. William Foster", "organization": "Los Angeles Superior",
         "attributes": {"courtroom_number": "504", "initials": "WF", "status": "Active"}},
    ]

    for j in judges_data:
        person = db.create_person(
            name=j["name"],
            person_type="judge",
            organization=j.get("organization"),
            attributes=j.get("attributes")
        )
        persons.append({"id": person["id"], "name": j["name"], "type": "judge"})

    # Experts
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
    ]

    for e in experts_data:
        person = db.create_person(
            name=e["name"],
            person_type="expert",
            organization=e.get("organization"),
            phones=e.get("phones"),
            emails=e.get("emails"),
            attributes=e.get("attributes")
        )
        persons.append({"id": person["id"], "name": e["name"], "type": "expert"})

    # Mediators
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
            person_type="mediator",
            organization=m.get("organization"),
            phones=m.get("phones"),
            emails=m.get("emails"),
            attributes=m.get("attributes")
        )
        persons.append({"id": person["id"], "name": m["name"], "type": "mediator"})

    # Helper to find person by name
    def find_person(name):
        for p in persons:
            if p["name"] == name:
                return p["id"]
        return None

    # ========== CASES ==========
    print("  Creating cases...")

    today = datetime.now().date()

    cases_data = [
        # Case 1: Active federal civil rights case in discovery
        {
            "case_name": "Martinez v. City of Los Angeles",
            "short_name": "Martinez",
            "status": "Discovery",
            "case_numbers": [{"number": "2:24-cv-01234-PAC", "label": "Federal", "primary": True}],
            "case_summary": "Section 1983 excessive force claim. Client was stopped by LAPD officers during a traffic stop and alleges she was subjected to excessive force, resulting in a torn rotator cuff and PTSD.",
            "date_of_injury": "2023-06-15",
            "client": "Maria Elena Martinez",
            "defendants": ["City of Los Angeles", "Los Angeles Police Department", "Officer John Smith (Badge #12345)"],
            "opp_counsel": "Michael Richardson",
            "judge": "Hon. Patricia Collins",
            "experts": ["Dr. Sarah Mitchell", "Dr. Michael Wong"],
        },
        # Case 2: State court case in expert discovery
        {
            "case_name": "Wilson v. ABC Trucking Inc.",
            "short_name": "Wilson",
            "status": "Expert Discovery",
            "case_numbers": [{"number": "23STCV45678", "label": "State", "primary": True}],
            "case_summary": "Trucking accident on I-10. Client was rear-ended by defendant's 18-wheeler. Suffered lumbar disc herniation requiring surgery.",
            "date_of_injury": "2022-11-20",
            "client": "James Robert Wilson",
            "defendants": ["ABC Trucking Inc."],
            "opp_counsel": "Jennifer Walsh",
            "judge": "Hon. Robert Takahashi",
            "experts": ["Dr. Sarah Mitchell", "Dr. Linda Park", "Dr. James Harrison"],
        },
        # Case 3: Pre-trial case with upcoming MSJ
        {
            "case_name": "Nguyen v. Metro Transit Authority",
            "short_name": "Nguyen",
            "status": "Pre-trial",
            "case_numbers": [{"number": "22STCV34567", "label": "State", "primary": True}],
            "case_summary": "Bus accident case. Client was a passenger on MTA bus that collided with another vehicle. TBI and cervical injuries.",
            "date_of_injury": "2022-03-08",
            "client": "Nguyen Thi Phuong",
            "defendants": ["Metro Transit Authority"],
            "opp_counsel": "David Chen",
            "judge": "Hon. William Foster",
            "experts": ["Dr. Linda Park", "Dr. James Harrison"],
        },
        # Case 4: Early stage federal case
        {
            "case_name": "Thompson v. County of Los Angeles",
            "short_name": "Thompson",
            "status": "Pleadings",
            "case_numbers": [{"number": "2:24-cv-05678-MLS", "label": "Federal", "primary": True}],
            "case_summary": "False arrest and malicious prosecution. Client was wrongfully arrested and held for 48 hours before charges were dropped.",
            "date_of_injury": "2024-01-10",
            "client": "Robert Charles Thompson",
            "defendants": ["County of Los Angeles"],
            "opp_counsel": "David Chen",
            "judge": "Hon. Maria Santos",
            "experts": [],
        },
        # Case 5: Settlement pending
        {
            "case_name": "Chen v. Westside Medical Center",
            "short_name": "Chen",
            "status": "Settl. Pend.",
            "case_numbers": [{"number": "23STCV12345", "label": "State", "primary": True}],
            "case_summary": "Medical malpractice - delayed diagnosis of appendicitis leading to rupture and sepsis.",
            "date_of_injury": "2022-09-05",
            "client": "Samantha Lynn Chen",
            "defendants": ["Westside Medical Center"],
            "opp_counsel": "Jennifer Walsh",
            "judge": "Hon. Robert Takahashi",
            "experts": ["Dr. Michael Wong"],
        },
        # Case 6: New intake
        {
            "case_name": "Davis v. City of Los Angeles",
            "short_name": "Davis",
            "status": "Signing Up",
            "case_numbers": [],
            "case_summary": "Potential excessive force case. Client alleges he was beaten during arrest. Still gathering records.",
            "date_of_injury": "2024-10-01",
            "client": "Marcus Anthony Davis",
            "defendants": ["City of Los Angeles", "Officer Jane Doe (Badge #67890)"],
            "opp_counsel": None,
            "judge": None,
            "experts": [],
        },
        # Case 7: Closed case
        {
            "case_name": "O'Brien v. ABC Trucking Inc.",
            "short_name": "O'Brien",
            "status": "Closed",
            "case_numbers": [{"number": "21STCV09876", "label": "State", "primary": True}],
            "case_summary": "Trucking accident on PCH. Settled for $1.2M after mediation.",
            "date_of_injury": "2020-12-15",
            "result": "Settled - $1,200,000",
            "client": "Patricia Ann O'Brien",
            "defendants": ["ABC Trucking Inc."],
            "opp_counsel": "Jennifer Walsh",
            "judge": "Hon. William Foster",
            "experts": ["Dr. Sarah Mitchell", "Dr. James Harrison"],
        },
        # Case 8: Pre-filing investigation
        {
            "case_name": "Kim v. Unknown Defendants",
            "short_name": "Kim",
            "status": "Pre-Filing",
            "case_numbers": [],
            "case_summary": "Hit and run investigation. Client was struck while crossing in crosswalk. Investigating to identify defendant.",
            "date_of_injury": "2024-09-15",
            "client": "David Kim",
            "defendants": [],
            "opp_counsel": None,
            "judge": None,
            "experts": [],
        },
    ]

    created_cases = []
    for c in cases_data:
        case = db.create_case(
            case_name=c["case_name"],
            status=c["status"],
            case_numbers=c.get("case_numbers"),
            case_summary=c.get("case_summary"),
            date_of_injury=c.get("date_of_injury"),
            short_name=c.get("short_name"),
            result=c.get("result")
        )
        case_id = case["id"]
        created_cases.append({"id": case_id, "name": c["case_name"], "data": c})

        # Assign client
        client_id = find_person(c["client"])
        if client_id:
            db.assign_person_to_case(case_id, client_id, "Client", side="plaintiff", is_primary=True)

        # Assign defendants
        for d in c.get("defendants", []):
            defendant_id = find_person(d)
            if defendant_id:
                db.assign_person_to_case(case_id, defendant_id, "Defendant", side="defendant")

        # Assign opposing counsel
        if c.get("opp_counsel"):
            opp_id = find_person(c["opp_counsel"])
            if opp_id:
                db.assign_person_to_case(case_id, opp_id, "Opposing Counsel", side="defendant")

        # Note: Judges are assigned via proceedings, not directly to cases

        # Assign experts
        for e in c.get("experts", []):
            expert_id = find_person(e)
            if expert_id:
                db.assign_person_to_case(case_id, expert_id, "Plaintiff Expert", side="plaintiff")

    # Helper to find case by name
    def find_case(name):
        for c in created_cases:
            if name in c["name"]:
                return c["id"]
        return None

    # ========== PROCEEDINGS ==========
    print("  Creating proceedings...")

    # Map case numbers to their jurisdictions and judges
    proceedings_data = [
        # Martinez - Federal C.D. Cal.
        {"case": "Martinez", "case_number": "2:24-cv-01234-PAC", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Patricia Collins", "is_primary": True},
        # Wilson - LA Superior
        {"case": "Wilson", "case_number": "23STCV45678", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. Robert Takahashi", "is_primary": True},
        # Nguyen - LA Superior
        {"case": "Nguyen", "case_number": "22STCV34567", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. William Foster", "is_primary": True},
        # Thompson - Federal C.D. Cal.
        {"case": "Thompson", "case_number": "2:24-cv-05678-MLS", "jurisdiction": "C.D. Cal.",
         "judge": "Hon. Maria Santos", "is_primary": True},
        # Chen - LA Superior
        {"case": "Chen", "case_number": "23STCV12345", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. Robert Takahashi", "is_primary": True},
        # O'Brien - LA Superior (closed case)
        {"case": "O'Brien", "case_number": "21STCV09876", "jurisdiction": "Los Angeles Superior",
         "judge": "Hon. William Foster", "is_primary": True},
    ]

    created_proceedings = []
    for p in proceedings_data:
        case_id = find_case(p["case"])
        jurisdiction_id = jurisdiction_map.get(p["jurisdiction"])
        judge_id = find_person(p["judge"]) if p.get("judge") else None

        if case_id and jurisdiction_id:
            proceeding = db.add_proceeding(
                case_id=case_id,
                case_number=p["case_number"],
                jurisdiction_id=jurisdiction_id,
                is_primary=p.get("is_primary", False)
            )
            created_proceedings.append(proceeding)

            # Add judge to proceeding if specified
            if judge_id and proceeding:
                db.add_judge_to_proceeding(
                    proceeding_id=proceeding["id"],
                    person_id=judge_id,
                    role="Judge"
                )

    # ========== EVENTS ==========
    print("  Creating events...")

    events_data = [
        # Martinez case events
        {"case": "Martinez", "date": (today + timedelta(days=14)).isoformat(), "description": "Discovery cutoff",
         "calculation_note": "Per scheduling order", "starred": True},
        {"case": "Martinez", "date": (today + timedelta(days=21)).isoformat(), "description": "Expert disclosure deadline",
         "calculation_note": "30 days before expert discovery cutoff"},
        {"case": "Martinez", "date": (today + timedelta(days=45)).isoformat(), "description": "Deposition of Officer Smith",
         "time": "10:00", "location": "City Attorney's Office, 200 N Main St"},
        {"case": "Martinez", "date": (today + timedelta(days=90)).isoformat(), "description": "MSJ hearing",
         "time": "09:00", "location": "Courtroom 8A, Roybal Federal Building", "starred": True},

        # Wilson case events
        {"case": "Wilson", "date": (today + timedelta(days=7)).isoformat(), "description": "Expert deposition - Dr. Mitchell",
         "time": "09:30", "location": "Veritext, 707 Wilshire Blvd"},
        {"case": "Wilson", "date": (today + timedelta(days=30)).isoformat(), "description": "Mediation",
         "time": "09:00", "location": "JAMS, 555 W 5th St", "starred": True},
        {"case": "Wilson", "date": (today + timedelta(days=60)).isoformat(), "description": "Trial",
         "time": "08:30", "location": "Dept 312, Stanley Mosk Courthouse", "starred": True},

        # Nguyen case events
        {"case": "Nguyen", "date": (today + timedelta(days=5)).isoformat(), "description": "MSJ opposition due",
         "starred": True},
        {"case": "Nguyen", "date": (today + timedelta(days=21)).isoformat(), "description": "MSJ hearing",
         "time": "10:30", "location": "Dept 504, Stanley Mosk Courthouse", "starred": True},
        {"case": "Nguyen", "date": (today + timedelta(days=75)).isoformat(), "description": "Final Status Conference",
         "time": "08:30", "location": "Dept 504"},
        {"case": "Nguyen", "date": (today + timedelta(days=90)).isoformat(), "description": "Trial",
         "time": "09:00", "location": "Dept 504, Stanley Mosk Courthouse", "starred": True},

        # Thompson case events
        {"case": "Thompson", "date": (today + timedelta(days=10)).isoformat(), "description": "Defendant's Answer due"},
        {"case": "Thompson", "date": (today + timedelta(days=45)).isoformat(), "description": "Rule 26(f) Conference",
         "time": "10:00"},

        # Chen case events
        {"case": "Chen", "date": (today + timedelta(days=3)).isoformat(), "description": "Settlement docs due to defense"},
        {"case": "Chen", "date": (today + timedelta(days=30)).isoformat(), "description": "Settlement funding deadline"},
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
        # Martinez case tasks
        {"case": "Martinez", "description": "Draft discovery responses", "urgency": 4, "due_date": (today + timedelta(days=7)).isoformat()},
        {"case": "Martinez", "description": "Prepare Officer Smith depo outline", "urgency": 3, "due_date": (today + timedelta(days=35)).isoformat()},
        {"case": "Martinez", "description": "Request body cam footage", "urgency": 3, "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Martinez", "description": "Review medical records from UCLA", "urgency": 2, "status": "Active"},
        {"case": "Martinez", "description": "Draft MSJ opposition brief", "urgency": 4, "due_date": (today + timedelta(days=60)).isoformat()},

        # Wilson case tasks
        {"case": "Wilson", "description": "Finalize Dr. Mitchell expert report", "urgency": 4, "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Wilson", "description": "Prepare mediation brief", "urgency": 3, "due_date": (today + timedelta(days=20)).isoformat()},
        {"case": "Wilson", "description": "Review defendant's expert reports", "urgency": 3, "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Wilson", "description": "Prepare trial exhibits", "urgency": 2, "due_date": (today + timedelta(days=45)).isoformat()},

        # Nguyen case tasks
        {"case": "Nguyen", "description": "Draft MSJ opposition", "urgency": 4, "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Nguyen", "description": "Compile evidence for opposition", "urgency": 4, "due_date": (today + timedelta(days=2)).isoformat()},
        {"case": "Nguyen", "description": "Prepare trial witness list", "urgency": 2, "due_date": (today + timedelta(days=60)).isoformat()},
        {"case": "Nguyen", "description": "Request interpreter for trial", "urgency": 2, "due_date": (today + timedelta(days=45)).isoformat()},

        # Thompson case tasks
        {"case": "Thompson", "description": "Review defendant's answer when filed", "urgency": 2, "due_date": (today + timedelta(days=15)).isoformat()},
        {"case": "Thompson", "description": "Draft initial discovery requests", "urgency": 2, "due_date": (today + timedelta(days=30)).isoformat()},
        {"case": "Thompson", "description": "Request jail records", "urgency": 3, "due_date": (today + timedelta(days=5)).isoformat()},

        # Chen case tasks
        {"case": "Chen", "description": "Review settlement agreement", "urgency": 4, "due_date": (today + timedelta(days=1)).isoformat()},
        {"case": "Chen", "description": "Calculate lien reductions", "urgency": 3, "due_date": (today + timedelta(days=7)).isoformat()},
        {"case": "Chen", "description": "Prepare disbursement sheet", "urgency": 3, "due_date": (today + timedelta(days=14)).isoformat()},

        # Davis case tasks (new intake)
        {"case": "Davis", "description": "Schedule client intake meeting", "urgency": 3, "due_date": (today + timedelta(days=2)).isoformat()},
        {"case": "Davis", "description": "Request police report", "urgency": 3, "due_date": (today + timedelta(days=3)).isoformat()},
        {"case": "Davis", "description": "Send records authorization to client", "urgency": 2, "due_date": (today + timedelta(days=1)).isoformat()},
        {"case": "Davis", "description": "Research statute of limitations", "urgency": 4, "due_date": (today + timedelta(days=1)).isoformat()},

        # Kim case tasks (pre-filing)
        {"case": "Kim", "description": "Order traffic camera footage", "urgency": 3, "due_date": (today + timedelta(days=5)).isoformat()},
        {"case": "Kim", "description": "Interview witnesses", "urgency": 3, "due_date": (today + timedelta(days=10)).isoformat()},
        {"case": "Kim", "description": "File police report request", "urgency": 2, "status": "Done", "completion_date": (today - timedelta(days=2)).isoformat()},

        # Completed tasks for variety
        {"case": "Martinez", "description": "File complaint", "urgency": 2, "status": "Done", "completion_date": (today - timedelta(days=60)).isoformat()},
        {"case": "Wilson", "description": "Complete written discovery", "urgency": 3, "status": "Done", "completion_date": (today - timedelta(days=30)).isoformat()},
        {"case": "Nguyen", "description": "Complete all depositions", "urgency": 3, "status": "Done", "completion_date": (today - timedelta(days=45)).isoformat()},
    ]

    for t in tasks_data:
        case_id = find_case(t["case"])
        if case_id:
            db.add_task(
                case_id=case_id,
                description=t["description"],
                urgency=t.get("urgency", 2),
                due_date=t.get("due_date"),
                status=t.get("status", "Pending")
            )
            # If there's a completion date, update the task
            if t.get("completion_date"):
                # Get the task we just created
                tasks_result = db.get_tasks(case_id=case_id)
                for task in tasks_result.get("tasks", []):
                    if task["description"] == t["description"]:
                        db.update_task_full(task["id"], completion_date=t["completion_date"])
                        break

    # ========== ACTIVITIES ==========
    print("  Creating activities...")

    activities_data = [
        {"case": "Martinez", "description": "Initial client meeting - discussed incident and injuries", "type": "Meeting", "minutes": 90, "days_ago": 65},
        {"case": "Martinez", "description": "Drafted and filed complaint", "type": "Drafting", "minutes": 180, "days_ago": 60},
        {"case": "Martinez", "description": "Reviewed medical records from UCLA ER", "type": "Document Review", "minutes": 45, "days_ago": 55},
        {"case": "Martinez", "description": "Phone call with client re: discovery responses", "type": "Phone Call", "minutes": 30, "days_ago": 10},
        {"case": "Martinez", "description": "Research on qualified immunity standards", "type": "Research", "minutes": 120, "days_ago": 5},

        {"case": "Wilson", "description": "Client meeting - prepared for deposition", "type": "Meeting", "minutes": 120, "days_ago": 45},
        {"case": "Wilson", "description": "Attended client deposition", "type": "Deposition", "minutes": 240, "days_ago": 40},
        {"case": "Wilson", "description": "Drafted mediation brief", "type": "Drafting", "minutes": 300, "days_ago": 15},
        {"case": "Wilson", "description": "Call with Dr. Mitchell re: expert opinion", "type": "Phone Call", "minutes": 45, "days_ago": 8},

        {"case": "Nguyen", "description": "Review defendant's MSJ motion", "type": "Document Review", "minutes": 90, "days_ago": 7},
        {"case": "Nguyen", "description": "Research on governmental immunity", "type": "Research", "minutes": 180, "days_ago": 5},
        {"case": "Nguyen", "description": "Draft opposition to MSJ", "type": "Drafting", "minutes": 360, "days_ago": 3},

        {"case": "Thompson", "description": "Initial client intake", "type": "Meeting", "minutes": 60, "days_ago": 20},
        {"case": "Thompson", "description": "Drafted federal complaint", "type": "Drafting", "minutes": 240, "days_ago": 15},
        {"case": "Thompson", "description": "Filed complaint and summons", "type": "Filing", "minutes": 30, "days_ago": 10},

        {"case": "Chen", "description": "Mediation at JAMS", "type": "Meeting", "minutes": 480, "days_ago": 14},
        {"case": "Chen", "description": "Draft settlement agreement review memo", "type": "Drafting", "minutes": 60, "days_ago": 7},
        {"case": "Chen", "description": "Call with defense counsel re: settlement terms", "type": "Phone Call", "minutes": 30, "days_ago": 5},

        {"case": "Davis", "description": "Initial phone screening", "type": "Phone Call", "minutes": 20, "days_ago": 3},
        {"case": "Kim", "description": "Initial client meeting", "type": "Meeting", "minutes": 45, "days_ago": 10},
        {"case": "Kim", "description": "Scene investigation", "type": "Other", "minutes": 90, "days_ago": 7},
    ]

    for a in activities_data:
        case_id = find_case(a["case"])
        if case_id:
            activity_date = (today - timedelta(days=a["days_ago"])).isoformat()
            db.add_activity(
                case_id=case_id,
                description=a["description"],
                activity_type=a["type"],
                minutes=a.get("minutes"),
                date=activity_date
            )

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
    ]

    for n in notes_data:
        case_id = find_case(n["case"])
        if case_id:
            db.add_note(case_id, n["content"])

    # ========== WEBHOOKS ==========
    print("  Creating webhook logs...")

    import uuid

    webhooks_data = [
        # Docket Alert webhook (event_type 1)
        {
            "source": "courtlistener",
            "event_type": "1",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {
                "webhook": {
                    "event_type": 1,
                    "version": 2,
                    "date_created": "2024-12-15T14:30:00-08:00"
                },
                "payload": {
                    "results": [
                        {
                            "docket": "https://www.courtlistener.com/api/rest/v4/dockets/68547231/",
                            "docket_id": 68547231,
                            "case_name": "Martinez v. City of Los Angeles",
                            "court": "cacd",
                            "docket_number": "2:24-cv-01234-PAC",
                            "date_filed": "2024-06-15",
                            "description": "ORDER granting Motion for Extension of Time"
                        }
                    ]
                }
            },
            "headers": {
                "content-type": "application/json",
                "user-agent": "CourtListener/2.0"
            },
            "processing_status": "completed"
        },
        # Search Alert webhook (event_type 2)
        {
            "source": "courtlistener",
            "event_type": "2",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {
                "webhook": {
                    "event_type": 2,
                    "version": 2,
                    "date_created": "2024-12-16T09:15:00-08:00"
                },
                "payload": {
                    "alert": {
                        "name": "Police Misconduct - Los Angeles",
                        "query": "police AND misconduct AND \"los angeles\"",
                        "rate": "rt"
                    },
                    "results": [
                        {
                            "caseName": "Davis v. City of Los Angeles",
                            "court": "C.D. Cal.",
                            "dateFiled": "2024-12-01",
                            "snippet": "...alleged excessive force by LAPD officers..."
                        }
                    ]
                }
            },
            "headers": {
                "content-type": "application/json",
                "user-agent": "CourtListener/2.0"
            },
            "processing_status": "pending"
        },
        # RECAP Fetch webhook (event_type 3)
        {
            "source": "courtlistener",
            "event_type": "3",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {
                "webhook": {
                    "event_type": 3,
                    "version": 2,
                    "date_created": "2024-12-14T16:45:00-08:00"
                },
                "payload": {
                    "status": "successful",
                    "docket": {
                        "absolute_url": "/docket/68123456/wilson-v-abc-trucking/",
                        "case_name": "Wilson v. ABC Trucking Inc.",
                        "docket_number": "23STCV45678",
                        "court": "lasc"
                    },
                    "recap_documents": [
                        {
                            "description": "Complaint",
                            "document_number": 1,
                            "filepath_local": "/storage/recap/lasc/23STCV45678/001.pdf"
                        },
                        {
                            "description": "Summons Issued",
                            "document_number": 2,
                            "filepath_local": "/storage/recap/lasc/23STCV45678/002.pdf"
                        }
                    ]
                }
            },
            "headers": {
                "content-type": "application/json",
                "user-agent": "CourtListener/2.0"
            },
            "processing_status": "completed"
        },
        # Old Docket Alert webhook (event_type 4)
        {
            "source": "courtlistener",
            "event_type": "4",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {
                "webhook": {
                    "event_type": 4,
                    "version": 2,
                    "date_created": "2024-12-10T11:00:00-08:00"
                },
                "payload": {
                    "message": "Your docket alert for O'Brien v. ABC Trucking Inc. (21STCV09876) has not had any new entries in over 180 days.",
                    "docket": {
                        "case_name": "O'Brien v. ABC Trucking Inc.",
                        "docket_number": "21STCV09876",
                        "court": "lasc",
                        "date_last_filing": "2023-06-15"
                    },
                    "recommendation": "Consider disabling this alert if the case has concluded."
                }
            },
            "headers": {
                "content-type": "application/json",
                "user-agent": "CourtListener/2.0"
            },
            "processing_status": "completed"
        },
        # Another Docket Alert with new filing
        {
            "source": "courtlistener",
            "event_type": "1",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {
                "webhook": {
                    "event_type": 1,
                    "version": 2,
                    "date_created": "2024-12-17T08:30:00-08:00"
                },
                "payload": {
                    "results": [
                        {
                            "docket": "https://www.courtlistener.com/api/rest/v4/dockets/68234567/",
                            "docket_id": 68234567,
                            "case_name": "Nguyen v. Metro Transit Authority",
                            "court": "lasc",
                            "docket_number": "22STCV34567",
                            "date_filed": "2024-12-16",
                            "description": "MOTION for Summary Judgment filed by Defendant Metro Transit Authority"
                        }
                    ]
                }
            },
            "headers": {
                "content-type": "application/json",
                "user-agent": "CourtListener/2.0"
            },
            "processing_status": "processing"
        },
        # Failed webhook (for testing error display)
        {
            "source": "courtlistener",
            "event_type": "1",
            "idempotency_key": str(uuid.uuid4()),
            "payload": {
                "webhook": {
                    "event_type": 1,
                    "version": 2,
                    "date_created": "2024-12-13T10:00:00-08:00"
                },
                "payload": {
                    "results": [
                        {
                            "docket_id": 99999999,
                            "case_name": "Unknown Case",
                            "court": "unknown",
                            "docket_number": "INVALID-123"
                        }
                    ]
                }
            },
            "headers": {
                "content-type": "application/json",
                "user-agent": "CourtListener/2.0"
            },
            "processing_status": "failed",
            "processing_error": "Could not match docket to any known case in the system"
        },
    ]

    for w in webhooks_data:
        # Store the idempotency_key before creation
        idem_key = w.get("idempotency_key")

        result = db.create_webhook_log(
            source=w["source"],
            payload=w["payload"],
            event_type=w.get("event_type"),
            idempotency_key=idem_key,
            headers=w.get("headers"),
        )

        # Update status if not pending
        if result and w.get("processing_status") != "pending":
            webhook_id = result["id"]
            if w["processing_status"] == "failed":
                db.mark_webhook_failed(webhook_id, w.get("processing_error", "Unknown error"))
            elif w["processing_status"] == "completed":
                db.mark_webhook_completed(webhook_id)
            elif w["processing_status"] == "processing":
                db.mark_webhook_processing(webhook_id)

    print("Development data seeded successfully!")
    print(f"  - {len(jurisdictions)} jurisdictions seeded")
    print(f"  - {len(db.get_person_types())} person types seeded")
    print(f"  - {len(db.get_expertise_types())} expertise types seeded")
    print(f"  - {len(persons)} persons created")
    print(f"  - {len(created_cases)} cases created")
    print(f"  - {len(created_proceedings)} proceedings created")
    print(f"  - {len(events_data)} events created")
    print(f"  - {len(tasks_data)} tasks created")
    print(f"  - {len(activities_data)} activities created")
    print(f"  - {len(notes_data)} notes created")
    print(f"  - {len(webhooks_data)} webhook logs created")


if __name__ == "__main__":
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()

    if not os.environ.get("DATABASE_URL"):
        print("ERROR: DATABASE_URL environment variable not set")
        print("Usage: DATABASE_URL='postgresql://...' python seed_dev_data.py")
        exit(1)

    seed_dev_data()
