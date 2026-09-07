import uuid
import datetime as dt
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.database.db import Base


def gen_id():
    return str(uuid.uuid4())


def now():
    return dt.datetime.utcnow()


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_id)
    email = Column(String, unique=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="viewer")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now)


class Person(Base):
    """Unified entity table for persons (criminals, associates, victims, officers-as-persons)."""
    __tablename__ = "persons"
    id = Column(String, primary_key=True, default=gen_id)
    full_name = Column(String, nullable=False)
    person_role = Column(String, default="associate")  # criminal, associate, victim, witness
    dob = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    address = Column(String, nullable=True)
    risk_band = Column(String, default="unknown")  # low, medium, high, unknown
    data_source = Column(String, default="SYNTHETIC")  # LIVE, DEMO, SYNTHETIC, UNKNOWN
    created_at = Column(DateTime, default=now)

    aliases = relationship("Alias", back_populates="person", cascade="all,delete")


class Alias(Base):
    __tablename__ = "aliases"
    id = Column(String, primary_key=True, default=gen_id)
    person_id = Column(String, ForeignKey("persons.id"), nullable=False)
    alias_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=now)

    person = relationship("Person", back_populates="aliases")


class Phone(Base):
    __tablename__ = "phones"
    id = Column(String, primary_key=True, default=gen_id)
    number = Column(String, nullable=False)
    owner_person_id = Column(String, ForeignKey("persons.id"), nullable=True)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(String, primary_key=True, default=gen_id)
    registration_number = Column(String, nullable=False)
    owner_person_id = Column(String, ForeignKey("persons.id"), nullable=True)
    vehicle_type = Column(String, nullable=True)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class Location(Base):
    __tablename__ = "locations"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    district = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    org_type = Column(String, default="organization")  # organization or gang
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"
    id = Column(String, primary_key=True, default=gen_id)
    account_number_masked = Column(String, nullable=False)
    owner_person_id = Column(String, ForeignKey("persons.id"), nullable=True)
    bank_name = Column(String, nullable=True)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True, default=gen_id)
    from_account_id = Column(String, ForeignKey("financial_accounts.id"), nullable=True)
    to_account_id = Column(String, ForeignKey("financial_accounts.id"), nullable=True)
    amount = Column(Float, nullable=True)
    txn_date = Column(DateTime, nullable=True)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class CrimeCase(Base):
    __tablename__ = "crime_cases"
    id = Column(String, primary_key=True, default=gen_id)
    case_number = Column(String, nullable=False)
    title = Column(String, nullable=False)
    crime_type = Column(String, nullable=True)
    district = Column(String, nullable=True)
    status = Column(String, default="open")
    opened_at = Column(DateTime, default=now)
    data_source = Column(String, default="SYNTHETIC")


class FIR(Base):
    __tablename__ = "firs"
    id = Column(String, primary_key=True, default=gen_id)
    fir_number = Column(String, nullable=False)
    case_id = Column(String, ForeignKey("crime_cases.id"), nullable=True)
    narrative_text = Column(Text, nullable=False)
    filed_at = Column(DateTime, default=now)
    location_id = Column(String, ForeignKey("locations.id"), nullable=True)
    data_source = Column(String, default="SYNTHETIC")


class Evidence(Base):
    __tablename__ = "evidence"
    id = Column(String, primary_key=True, default=gen_id)
    evidence_type = Column(String, nullable=False)  # FIR, CDR, SURVEILLANCE, FINANCIAL, INVESTIGATION_NOTE
    source_record_id = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    storage_path = Column(String, nullable=True)
    # File/object storage metadata (columns exist in the approved Supabase schema)
    storage_url = Column(String, nullable=True)
    mime_type = Column(String, nullable=True)
    # SHA-256 integrity: digest persisted at registration and compared on verification
    file_hash = Column(String, nullable=True)
    source_hash = Column(String, nullable=True)  # digest of raw content bytes when uploaded
    # Tamper-Evident Integrity Ledger: hash chain links recorded per record
    previous_hash = Column(String, nullable=True)  # ledger hash of the prior record in the chain
    ledger_position = Column(Integer, nullable=True, default=0)
    ledger_anchor = Column(String, nullable=True)  # root anchor hash of the chain
    # Human verification state (distinct from cryptographic integrity)
    verification_status = Column(String, nullable=False, default="REQUIRES_REVIEW")  # VERIFIED | REJECTED | REQUIRES_REVIEW
    verified_by = Column(String, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    confidence = Column(Float, default=0.9)
    data_source = Column(String, default="SYNTHETIC")
    created_at = Column(DateTime, default=now)


class EntityMention(Base):
    __tablename__ = "entity_mentions"
    id = Column(String, primary_key=True, default=gen_id)
    source_record_id = Column(String, nullable=True)
    source_record_type = Column(String, nullable=True)  # FIR, CDR, SURVEILLANCE, FINANCIAL
    entity_text = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)  # PERSON, ALIAS, PHONE, VEHICLE, LOCATION, ORG, GANG...
    confidence = Column(Float, default=0.8)
    span_start = Column(Integer, nullable=True)
    span_end = Column(Integer, nullable=True)
    extraction_model = Column(String, default="drishyam-ner-v1")
    resolved_entity_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=now)


class EntityMatch(Base):
    __tablename__ = "entity_matches"
    id = Column(String, primary_key=True, default=gen_id)
    source_entity_id = Column(String, nullable=False)
    candidate_entity_id = Column(String, nullable=False)
    match_score = Column(Float, nullable=False)
    match_status = Column(String, default="UNRESOLVED")  # CONFIRMED, PROBABLE, POSSIBLE, REJECTED, UNRESOLVED
    matching_method = Column(String, nullable=True)
    supporting_evidence = Column(JSON, default=list)
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now)


class RelationshipRecord(Base):
    __tablename__ = "relationships"
    id = Column(String, primary_key=True, default=gen_id)
    source_entity_id = Column(String, nullable=False)
    source_entity_type = Column(String, nullable=False)
    target_entity_id = Column(String, nullable=False)
    target_entity_type = Column(String, nullable=False)
    relationship_type = Column(String, nullable=False)
    confidence_score = Column(Float, default=0.8)
    first_seen_at = Column(DateTime, default=now)
    last_seen_at = Column(DateTime, default=now)
    source_record_id = Column(String, nullable=True)
    source_record_type = Column(String, nullable=True)
    evidence_id = Column(String, ForeignKey("evidence.id"), nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=now)


class Anomaly(Base):
    __tablename__ = "anomalies"
    id = Column(String, primary_key=True, default=gen_id)
    entity_id = Column(String, nullable=False)
    entity_type = Column(String, default="PERSON")
    anomaly_type = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    severity = Column(String, default="medium")  # low, medium, high
    related_entities = Column(JSON, default=list)
    evidence_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, default=gen_id)
    alert_type = Column(String, nullable=False)
    what_happened = Column(Text, nullable=False)
    why_it_matters = Column(Text, nullable=False)
    affected_entities = Column(JSON, default=list)
    supporting_records = Column(JSON, default=list)
    confidence = Column(Float, default=0.8)
    created_at = Column(DateTime, default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column(String, nullable=True)
    action = Column(String, nullable=False)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime, default=now)


class ImportJob(Base):
    __tablename__ = "import_jobs"
    id = Column(String, primary_key=True, default=gen_id)
    job_type = Column(String, nullable=False)  # fir, cdr, financial, surveillance
    filename = Column(String, nullable=True)
    status = Column(String, default="completed")
    entities_extracted = Column(Integer, default=0)
    relationships_created = Column(Integer, default=0)
    created_at = Column(DateTime, default=now)


class IntelligenceReport(Base):
    __tablename__ = "intelligence_reports"
    id = Column(String, primary_key=True, default=gen_id)
    report_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=True)
    case_id = Column(String, nullable=True)
    title = Column(String, nullable=False)
    content_json = Column(JSON, default=dict)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=now)
