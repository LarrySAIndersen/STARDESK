"""Standard ITSM-kategorier og underkategorier (synkroniseres idempotent via admin)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DefaultSubcategory:
    name: str
    name_da: str
    sort_order: int = 0


@dataclass(frozen=True)
class DefaultCategory:
    name: str
    name_da: str
    sort_order: int
    subcategories: tuple[DefaultSubcategory, ...]


DEFAULT_CATEGORIES: tuple[DefaultCategory, ...] = (
    DefaultCategory(
        "hardware",
        "Hardware",
        10,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("pc", "PC og bærbar", 10),
            DefaultSubcategory("printer", "Printer og scanner", 20),
            DefaultSubcategory("mobile", "Mobil og tablet", 30),
            DefaultSubcategory("peripherals", "Tilbehør", 40),
        ),
    ),
    DefaultCategory(
        "software",
        "Software",
        20,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("office365", "Microsoft 365", 10),
            DefaultSubcategory("erp", "ERP og forretningssystemer", 20),
            DefaultSubcategory("custom_app", "Specialudviklet applikation", 30),
            DefaultSubcategory("update_patch", "Opdatering og patch", 40),
        ),
    ),
    DefaultCategory(
        "access",
        "Adgang og rettigheder",
        30,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("ad", "Active Directory / konto", 10),
            DefaultSubcategory("password", "Adgangskode og MFA", 20),
            DefaultSubcategory("permissions", "Rettigheder og roller", 30),
            DefaultSubcategory("new_user", "Ny medarbejder", 40),
        ),
    ),
    DefaultCategory(
        "network",
        "Netværk og internet",
        40,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("vpn", "VPN og fjernadgang", 10),
            DefaultSubcategory("wifi", "Wi-Fi og trådløst", 20),
            DefaultSubcategory("connectivity", "Forbindelse og nedbrud", 30),
            DefaultSubcategory("firewall", "Firewall og sikkerhedsnet", 40),
        ),
    ),
    DefaultCategory(
        "security",
        "Sikkerhed",
        50,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("incident", "Sikkerhedshændelse", 10),
            DefaultSubcategory("phishing", "Phishing og svindel", 20),
            DefaultSubcategory("malware", "Malware og virus", 30),
            DefaultSubcategory("compliance", "Compliance og politik", 40),
        ),
    ),
    DefaultCategory(
        "email_collaboration",
        "E-mail og samarbejde",
        60,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("outlook", "Outlook og mail", 10),
            DefaultSubcategory("teams", "Teams og chat", 20),
            DefaultSubcategory("sharepoint", "SharePoint og filer", 30),
        ),
    ),
    DefaultCategory(
        "cloud_services",
        "Cloud og SaaS",
        70,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("azure", "Azure og infrastruktur", 10),
            DefaultSubcategory("saas", "SaaS-applikation", 20),
            DefaultSubcategory("integration", "Integration og API", 30),
        ),
    ),
    DefaultCategory(
        "telephony",
        "Telefoni og møder",
        80,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("phone", "Telefon og softphone", 10),
            DefaultSubcategory("meeting_rooms", "Mødelokaler og udstyr", 20),
        ),
    ),
    DefaultCategory(
        "it_support",
        "IT-support generelt",
        90,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("how_to", "Vejledning og how-to", 10),
            DefaultSubcategory("request", "Ønske og forbedring", 20),
        ),
    ),
    DefaultCategory(
        "hr_personnel",
        "HR og personale",
        100,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("onboarding", "Onboarding og offboarding", 10),
            DefaultSubcategory("hr_systems", "HR-systemer", 20),
        ),
    ),
    DefaultCategory(
        "facilities",
        "Faciliteter og lokaler",
        110,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("building_access", "Adgang til bygning", 10),
            DefaultSubcategory("maintenance", "Vedligehold og reparation", 20),
        ),
    ),
    DefaultCategory(
        "procurement",
        "Indkøb og licenser",
        120,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("hardware_order", "Bestilling af hardware", 10),
            DefaultSubcategory("license", "Licens og abonnement", 20),
        ),
    ),
    DefaultCategory(
        "training",
        "Oplæring og vejledning",
        130,
        (
            DefaultSubcategory("general", "Generelt", 0),
            DefaultSubcategory("user_guide", "Brugervejledning", 10),
            DefaultSubcategory("course", "Kursus og træning", 20),
        ),
    ),
    DefaultCategory(
        "other",
        "Andet",
        999,
        (DefaultSubcategory("general", "Generelt", 0), DefaultSubcategory("uncategorized", "Ikke kategoriseret", 10)),
    ),
)

DEFAULT_FILL_CATEGORY_NAME = "other"
DEFAULT_FILL_SUBCATEGORY_NAME = "general"
