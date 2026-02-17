"""reset jurisdictions judges proceedings and reseed

One-time data migration: wipe all proceedings, judges, and jurisdictions,
then reseed jurisdictions and judges from seed data.

All seed data is inlined so the migration is self-contained (no external
imports from scripts/ or db/).

Revision ID: bcac9095af3b
Revises: a1eeb5be4825
Create Date: 2026-02-16 15:05:35.541602

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bcac9095af3b'
down_revision: Union[str, Sequence[str], None] = 'a1eeb5be4825'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Inline seed data ────────────────────────────────────────────────────────

JURISDICTIONS = [
    {"name": "C.D. Cal.", "local_rules_link": "https://www.cacd.uscourts.gov/court-procedures/local-rules"},
    {"name": "E.D. Cal.", "local_rules_link": "https://www.caed.uscourts.gov/caednew/index.cfm/rules/local-rules/"},
    {"name": "N.D. Cal.", "local_rules_link": "https://www.cand.uscourts.gov/rules/local-rules/"},
    {"name": "S.D. Cal.", "local_rules_link": "https://www.casd.uscourts.gov/rules.aspx"},
    {"name": "9th Cir.", "local_rules_link": "https://www.ca9.uscourts.gov/rules/"},
    {"name": "Los Angeles Superior", "local_rules_link": "https://www.lacourt.org/courtrules/ui/"},
    {"name": "Orange County Superior", "local_rules_link": None},
    {"name": "San Diego Superior", "local_rules_link": None},
    {"name": "Riverside Superior", "local_rules_link": None},
    {"name": "San Bernardino Superior", "local_rules_link": None},
]

# Keyed by jurisdiction name (must match JURISDICTIONS above)
JUDGES = {
    "C.D. Cal.": [
        # District Judges
        {"name": "Dolly M. Gee", "title": "Judge", "initials": "DMG", "notes": "Chief Judge", "chambers": "First Street U.S. Courthouse, Courtroom 8C, 8th Floor", "courtroom_number": "8C", "appointed_by": "Obama"},
        {"name": "Fernando L. Aenlle-Rocha", "title": "Judge", "initials": "FLA", "chambers": "First Street U.S. Courthouse, Courtroom 6B, 6th Floor", "courtroom_number": "6B", "appointed_by": "Trump"},
        {"name": "Percy Anderson", "title": "Judge", "initials": "PA", "chambers": "First Street U.S. Courthouse, Courtroom 9A, 9th Floor", "courtroom_number": "9A", "appointed_by": "Bush"},
        {"name": "Jesus G. Bernal", "title": "Judge", "initials": "JGB", "chambers": "George E. Brown Federal Courthouse, Courtroom 1, 2nd Floor", "courtroom_number": "1", "appointed_by": "Obama"},
        {"name": "André Birotte Jr.", "title": "Judge", "initials": "AB", "chambers": "First Street U.S. Courthouse, Courtroom 7B, 7th Floor", "courtroom_number": "7B", "appointed_by": "Obama"},
        {"name": "Stanley Blumenfeld Jr.", "title": "Judge", "initials": "SB", "chambers": "First Street U.S. Courthouse, Courtroom 6C, 6th Floor", "courtroom_number": "6C", "appointed_by": "Trump"},
        {"name": "David O. Carter", "title": "Judge", "initials": "DOC", "chambers": "Ronald Reagan Federal Building, Courtroom 10A, 10th Floor", "courtroom_number": "10A", "appointed_by": "Clinton"},
        {"name": "Michelle Williams Court", "title": "Judge", "initials": "MWC", "chambers": "First Street U.S. Courthouse, Courtroom 6A, 6th Floor", "courtroom_number": "6A", "appointed_by": "Biden"},
        {"name": "Michael W. Fitzgerald", "title": "Judge", "initials": "MWF", "chambers": "First Street U.S. Courthouse, Courtroom 5A, 5th Floor", "courtroom_number": "5A", "appointed_by": "Obama"},
        {"name": "Maame Ewusi-Mensah Frimpong", "title": "Judge", "initials": "MEMF", "chambers": "First Street U.S. Courthouse, Courtroom 8B, 8th Floor", "courtroom_number": "8B", "appointed_by": "Biden"},
        {"name": "Sherilyn Peace Garnett", "title": "Judge", "initials": "SPG", "chambers": "First Street U.S. Courthouse, Courtroom 5C, 5th Floor", "courtroom_number": "5C", "appointed_by": "Biden"},
        {"name": "John W. Holcomb", "title": "Judge", "initials": "JWH", "chambers": "Ronald Reagan Federal Building, Courtroom 9D, 9th Floor", "courtroom_number": "9D", "appointed_by": "Trump"},
        {"name": "Wesley L. Hsu", "title": "Judge", "initials": "WLH", "chambers": "First Street U.S. Courthouse, Courtroom 9B, 9th Floor", "courtroom_number": "9B", "appointed_by": "Biden"},
        {"name": "Anne Hwang", "title": "Judge", "initials": "AH", "chambers": "First Street U.S. Courthouse, Courtroom 9C, 9th Floor", "courtroom_number": "9C", "appointed_by": "Biden"},
        {"name": "Kenly Kiya Kato", "title": "Judge", "initials": "KK", "chambers": "George E. Brown Federal Courthouse, Courtroom 3, 3rd Floor", "courtroom_number": "3", "appointed_by": "Biden"},
        {"name": "R. Gary Klausner", "title": "Judge", "initials": "RGK", "chambers": "Spring Street U.S. Courthouse, Courtroom 850, 8th Floor", "courtroom_number": "850", "appointed_by": "Bush"},
        {"name": "Serena R. Murillo", "title": "Judge", "initials": "SRM", "chambers": "First Street U.S. Courthouse, Courtroom 5D, 5th Floor", "courtroom_number": "5D", "appointed_by": "Biden"},
        {"name": "Fernando M. Olguin", "title": "Judge", "initials": "FMO", "chambers": "First Street U.S. Courthouse, Courtroom 6D, 6th Floor", "courtroom_number": "6D", "appointed_by": "Obama"},
        {"name": "Mónica Ramírez Almadani", "title": "Judge", "initials": "MRA", "chambers": "Ronald Reagan Federal Building, Courtroom 9B, 9th Floor", "courtroom_number": "9B", "appointed_by": "Biden"},
        {"name": "Mark C. Scarsi", "title": "Judge", "initials": "MCS", "chambers": "First Street U.S. Courthouse, Courtroom 7C, 7th Floor", "courtroom_number": "7C", "appointed_by": "Trump"},
        {"name": "Fred W. Slaughter", "title": "Judge", "initials": "FWS", "chambers": "Ronald Reagan Federal Building, Courtroom 10D, 10th Floor", "courtroom_number": "10D", "appointed_by": "Biden"},
        {"name": "Josephine L. Staton", "title": "Judge", "initials": "JLS", "chambers": "First Street U.S. Courthouse, Courtroom 8A, 8th Floor", "courtroom_number": "8A", "appointed_by": "Obama"},
        {"name": "Sunshine S. Sykes", "title": "Judge", "initials": "SSS", "chambers": "George E. Brown Federal Courthouse, Courtroom 2, 2nd Floor", "courtroom_number": "2", "appointed_by": "Biden"},
        {"name": "Cynthia Valenzuela", "title": "Judge", "initials": "CV", "chambers": "First Street U.S. Courthouse, Courtroom 10B, 10th Floor", "courtroom_number": "10B", "appointed_by": "Biden"},
        {"name": "Hernán D. Vera", "title": "Judge", "initials": "HDV", "chambers": "First Street U.S. Courthouse, Courtroom 5B, 5th Floor", "courtroom_number": "5B", "appointed_by": "Biden"},
        {"name": "John F. Walter", "title": "Judge", "initials": "JFW", "chambers": "First Street U.S. Courthouse, Courtroom 7A, 7th Floor", "courtroom_number": "7A", "appointed_by": "Bush"},
        {"name": "Stephen V. Wilson", "title": "Judge", "initials": "SVW", "chambers": "First Street U.S. Courthouse, Courtroom 10A, 10th Floor", "courtroom_number": "10A", "appointed_by": "Reagan"},
        {"name": "Otis D. Wright II", "title": "Judge", "initials": "ODW", "chambers": "First Street U.S. Courthouse, Courtroom 5D, 5th Floor", "courtroom_number": "5D", "appointed_by": "Bush"},
        {"name": "Valerie B. Fairbank", "title": "Judge", "initials": "VBF", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 8C, 8th Floor", "courtroom_number": "8C", "appointed_by": "Bush"},
        {"name": "Dale S. Fischer", "title": "Judge", "initials": "DSF", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 7D, 7th Floor", "courtroom_number": "7D", "appointed_by": "Bush"},
        {"name": "Terry J. Hatter Jr.", "title": "Judge", "initials": "TJH", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 9C, 9th Floor", "courtroom_number": "9C", "appointed_by": "Carter"},
        {"name": "John A. Kronstadt", "title": "Judge", "initials": "JAK", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 10C, 10th Floor", "courtroom_number": "10C", "appointed_by": "Obama"},
        {"name": "Consuelo B. Marshall", "title": "Judge", "initials": "CBM", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 8D, 8th Floor", "courtroom_number": "8D", "appointed_by": "Carter"},
        {"name": "Virginia A. Phillips", "title": "Judge", "initials": "VAP", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 6A, 6th Floor", "courtroom_number": "6A", "appointed_by": "Clinton"},
        {"name": "James V. Selna", "title": "Judge", "initials": "JVS", "notes": "Senior status", "chambers": "Ronald Reagan Federal Building, Courtroom 10C, 10th Floor", "courtroom_number": "10C", "appointed_by": "Bush"},
        {"name": "Christina A. Snyder", "title": "Judge", "initials": "CAS", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 8D, 8th Floor", "courtroom_number": "8D", "appointed_by": "Clinton"},
        {"name": "George H. Wu", "title": "Judge", "initials": "GW", "notes": "Senior status", "chambers": "First Street U.S. Courthouse, Courtroom 9D, 9th Floor", "courtroom_number": "9D", "appointed_by": "Bush"},
        # Magistrate Judges
        {"name": "Karen L. Stevenson", "title": "Magistrate", "initials": "KS", "notes": "Chief Magistrate Judge", "chambers": "Spring Street U.S. Courthouse, Courtroom 580, 5th Floor", "courtroom_number": "580"},
        {"name": "Maria A. Audero", "title": "Magistrate", "initials": "MAA", "chambers": "Spring Street U.S. Courthouse, Courtroom 880, 8th Floor", "courtroom_number": "880"},
        {"name": "David T. Bristow", "title": "Magistrate", "initials": "DTB", "chambers": "George E. Brown Federal Courthouse, Courtroom 4, 3rd Floor", "courtroom_number": "4"},
        {"name": "Pedro V. Castillo", "title": "Magistrate", "initials": "PVC", "chambers": "Spring Street U.S. Courthouse, Courtroom 590, 5th Floor", "courtroom_number": "590"},
        {"name": "Jacqueline Chooljian", "title": "Magistrate", "initials": "JC", "chambers": "Spring Street U.S. Courthouse, Courtroom 750, 7th Floor", "courtroom_number": "750"},
        {"name": "Stephanie S. Christensen", "title": "Magistrate", "initials": "SSC", "chambers": "Spring Street U.S. Courthouse, Courtroom 790, 7th Floor", "courtroom_number": "790"},
        {"name": "Patricia Donahue", "title": "Magistrate", "initials": "PD", "chambers": "Spring Street U.S. Courthouse, Courtroom 580, 5th Floor", "courtroom_number": "580"},
        {"name": "John D. Early", "title": "Magistrate", "initials": "JDE", "chambers": "Ronald Reagan Federal Building, Courtroom 6A, 6th Floor", "courtroom_number": "6A"},
        {"name": "Charles F. Eick", "title": "Magistrate", "initials": "E", "chambers": "Spring Street U.S. Courthouse, Courtroom 750, 7th Floor", "courtroom_number": "750"},
        {"name": "Michael B. Kaufman", "title": "Magistrate", "initials": "MBK", "chambers": "Spring Street U.S. Courthouse, Courtroom 550, 5th Floor", "courtroom_number": "550"},
        {"name": "Steve Kim", "title": "Magistrate", "initials": "SK", "chambers": "Spring Street U.S. Courthouse, Courtroom 540, 5th Floor", "courtroom_number": "540"},
        {"name": "Douglas F. McCormick", "title": "Magistrate", "initials": "DFM", "chambers": "Ronald Reagan Federal Building, Courtroom 6B, 6th Floor", "courtroom_number": "6B"},
        {"name": "Brianna Fuller Mircheff", "title": "Magistrate", "initials": "BFM", "chambers": "Spring Street U.S. Courthouse, Courtroom 780, 7th Floor", "courtroom_number": "780"},
        {"name": "Rozella A. Oliver", "title": "Magistrate", "initials": "RAO", "chambers": "Spring Street U.S. Courthouse, Courtroom 590, 5th Floor", "courtroom_number": "590"},
        {"name": "Sheri Pym", "title": "Magistrate", "initials": "SP", "chambers": "George E. Brown Federal Courthouse, Courtroom 4, 3rd Floor", "courtroom_number": "4"},
        {"name": "A. Joel Richlin", "title": "Magistrate", "initials": "AJR", "chambers": "Spring Street U.S. Courthouse, Courtroom 780, 7th Floor", "courtroom_number": "780"},
        {"name": "Daniel S. Roberts", "title": "Magistrate", "initials": "DSR", "chambers": "Spring Street U.S. Courthouse, Courtroom 690, 6th Floor", "courtroom_number": "690"},
        {"name": "Margo A. Rocconi", "title": "Magistrate", "initials": "MAR", "chambers": "Spring Street U.S. Courthouse, Courtroom 790, 7th Floor", "courtroom_number": "790"},
        {"name": "Alicia G. Rosenberg", "title": "Magistrate", "initials": "AGR", "chambers": "Spring Street U.S. Courthouse, Courtroom 550, 5th Floor", "courtroom_number": "550"},
        {"name": "Alka Sagar", "title": "Magistrate", "initials": "AS", "chambers": "Spring Street U.S. Courthouse, Courtroom 540, 5th Floor", "courtroom_number": "540"},
        {"name": "Karen E. Scott", "title": "Magistrate", "initials": "KES", "chambers": "Ronald Reagan Federal Building, Courtroom 6D, 6th Floor", "courtroom_number": "6D"},
        {"name": "Autumn D. Spaeth", "title": "Magistrate", "initials": "ADS", "chambers": "Ronald Reagan Federal Building, Courtroom 6B, 6th Floor", "courtroom_number": "6B"},
        {"name": "Angela C. C. Viramontes", "title": "Magistrate", "initials": "ACCV", "chambers": "George E. Brown Federal Courthouse, Courtroom 4, 3rd Floor", "courtroom_number": "4"},
    ],

    "E.D. Cal.": [
        {"name": "Troy L. Nunley", "title": "Judge", "initials": "TLN", "notes": "Chief Judge"},
        {"name": "Daniel J. Calabretta", "title": "Judge", "initials": "DJC"},
        {"name": "Dena Coggins", "title": "Judge", "initials": "DC"},
        {"name": "Dale A. Drozd", "title": "Judge", "initials": "DAD"},
        {"name": "Kirk E. Sherriff", "title": "Judge", "initials": "KES"},
        {"name": "Jennifer L. Thurston", "title": "Judge", "initials": "JLT"},
        {"name": "John A. Mendez", "title": "Judge", "initials": "JAM", "notes": "Senior status"},
        {"name": "William B. Shubb", "title": "Judge", "initials": "WBS", "notes": "Senior status"},
        {"name": "Carolyn K. Delaney", "title": "Magistrate", "initials": "CKD", "notes": "Chief Magistrate Judge"},
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

    "N.D. Cal.": [
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
        {"name": "Nathanael Cousins", "title": "Magistrate", "initials": "NC", "notes": "Chief Magistrate Judge"},
        {"name": "Laurel Beeler", "title": "Magistrate", "initials": "LB"},
        {"name": "Lisa J. Cisneros", "title": "Magistrate", "initials": "LJC"},
        {"name": "Thomas S. Hixson", "title": "Magistrate", "initials": "TSH"},
        {"name": "Peter H. Kang", "title": "Magistrate", "initials": "PHK"},
        {"name": "Sallie Kim", "title": "Magistrate", "initials": "SK"},
        {"name": "Joseph C. Spero", "title": "Magistrate", "initials": "JCS"},
        {"name": "Alex G. Tse", "title": "Magistrate", "initials": "AGT"},
        {"name": "Robert M. Illman", "title": "Magistrate", "initials": "RMI"},
        {"name": "Ajay S. Krishnan", "title": "Magistrate", "initials": "ASK"},
        {"name": "Kandis A. Westmore", "title": "Magistrate", "initials": "KAW"},
        {"name": "Virginia K. DeMarchi", "title": "Magistrate", "initials": "VKD"},
        {"name": "Susan van Keulen", "title": "Magistrate", "initials": "SVK"},
    ],

    "S.D. Cal.": [
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

    "9th Cir.": [
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


def upgrade() -> None:
    """Delete all proceedings/judges/jurisdictions and reseed from scratch."""
    conn = op.get_bind()

    # 1. Delete in FK-safe order
    conn.execute(sa.text("DELETE FROM proceeding_judges"))
    conn.execute(sa.text(
        "UPDATE webhook_logs SET proceeding_id = NULL "
        "WHERE proceeding_id IS NOT NULL"
    ))
    conn.execute(sa.text("DELETE FROM proceedings"))
    conn.execute(sa.text("DELETE FROM judges"))
    conn.execute(sa.text("DELETE FROM jurisdictions"))

    # 2. Seed jurisdictions
    for j in JURISDICTIONS:
        conn.execute(
            sa.text(
                "INSERT INTO jurisdictions (name, local_rules_link) "
                "VALUES (:name, :local_rules_link) "
                "ON CONFLICT (name) DO NOTHING"
            ),
            {"name": j["name"], "local_rules_link": j["local_rules_link"]},
        )

    # 3. Build jurisdiction name -> id map
    rows = conn.execute(sa.text("SELECT id, name FROM jurisdictions")).fetchall()
    jmap = {row[1]: row[0] for row in rows}

    # 4. Seed judges
    for jurisdiction_name, judges in JUDGES.items():
        jid = jmap.get(jurisdiction_name)
        if not jid:
            continue

        for jdata in judges:
            conn.execute(
                sa.text(
                    "INSERT INTO judges "
                    "(name, title, initials, jurisdiction_id, status, notes, "
                    " chambers, courtroom_number, appointed_by, phones, emails) "
                    "VALUES (:name, :title, :initials, :jurisdiction_id, :status, "
                    " :notes, :chambers, :courtroom_number, :appointed_by, "
                    " '[]'::jsonb, '[]'::jsonb)"
                ),
                {
                    "name": jdata["name"],
                    "title": jdata.get("title"),
                    "initials": jdata.get("initials"),
                    "jurisdiction_id": jid,
                    "status": jdata.get("status", "Active"),
                    "notes": jdata.get("notes"),
                    "chambers": jdata.get("chambers"),
                    "courtroom_number": jdata.get("courtroom_number"),
                    "appointed_by": jdata.get("appointed_by"),
                },
            )


def downgrade() -> None:
    """No downgrade — this is a one-time data reset."""
    pass
