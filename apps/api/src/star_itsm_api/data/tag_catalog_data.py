"""Curated ITSM tag catalog — file-backed until DB table (see docs/adr)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TagCatalogEntryData:
    slug: str
    label_da: str
    category: str
    keywords: tuple[str, ...]
    synonyms: tuple[str, ...] = ()
    auto_suggest: bool = True
    description_da: str | None = None


TAG_CATALOG_ENTRIES: tuple[TagCatalogEntryData, ...] = (
    TagCatalogEntryData(
        slug="vpn",
        label_da="VPN",
        category="infrastruktur",
        keywords=("vpn", "fjernarbejde", "remote", "hjemmefra", "citrix"),
        synonyms=("fjernarbejde",),
        description_da="Fjernadgang og VPN-forbindelse",
    ),
    TagCatalogEntryData(
        slug="printer",
        label_da="Printer",
        category="hardware",
        keywords=("printer", "print", "udskrift", "toner", "scanner"),
        description_da="Printere og udskrift",
    ),
    TagCatalogEntryData(
        slug="adgang",
        label_da="Adgang",
        category="sikkerhed",
        keywords=("adgang", "login", "logge ind", "konto", "bruger"),
        synonyms=("login", "konto"),
        description_da="Login og brugerkonti",
    ),
    TagCatalogEntryData(
        slug="adgangskode",
        label_da="Adgangskode",
        category="sikkerhed",
        keywords=("adgangskode", "password", "kodeord", "nulstil"),
        synonyms=("password", "kodeord"),
        description_da="Adgangskoder og nulstilling",
    ),
    TagCatalogEntryData(
        slug="mail",
        label_da="E-mail",
        category="applikation",
        keywords=("mail", "e-mail", "email", "outlook", "exchange", "indbakke"),
        synonyms=("outlook", "e-mail", "email"),
        description_da="E-mail og Outlook",
    ),
    TagCatalogEntryData(
        slug="microsoft365",
        label_da="Microsoft 365",
        category="applikation",
        keywords=("microsoft365", "office", "teams", "sharepoint", "onedrive", "m365"),
        synonyms=("office", "teams", "sharepoint"),
        description_da="Microsoft 365 og Office-apps",
    ),
    TagCatalogEntryData(
        slug="netværk",
        label_da="Netværk",
        category="infrastruktur",
        keywords=("netværk", "network", "wifi", "wi-fi", "internet", "lan"),
        synonyms=("wifi", "network"),
        description_da="Netværk og Wi-Fi",
    ),
    TagCatalogEntryData(
        slug="hardware",
        label_da="Hardware",
        category="hardware",
        keywords=("hardware", "skærm", "tastatur", "mus", "laptop", "pc", "enhed"),
        description_da="Fysiske enheder",
    ),
    TagCatalogEntryData(
        slug="sikkerhed",
        label_da="Sikkerhed",
        category="sikkerhed",
        keywords=("sikkerhed", "gdpr", "cpr", "phishing", "virus", "malware"),
        description_da="Informationssikkerhed",
    ),
    TagCatalogEntryData(
        slug="akut",
        label_da="Akut",
        category="prioritet",
        keywords=("akut", "haster", "straks", "kritisk", "nedetid", "outage"),
        synonyms=("haster", "nedetid"),
        description_da="Hastesager og nedetid",
    ),
    TagCatalogEntryData(
        slug="integration",
        label_da="Integration",
        category="applikation",
        keywords=("integration", "api", "kobling", "sync", "synkronisering"),
        description_da="Systemintegrationer",
    ),
    TagCatalogEntryData(
        slug="jobflow",
        label_da="Jobflow",
        category="forretning",
        keywords=("jobflow", "jobcenter", "ydelse", "sagsbehandling"),
        description_da="Jobcenter og ydelsessystemer",
    ),
    TagCatalogEntryData(
        slug="bi",
        label_da="BI / rapporter",
        category="applikation",
        keywords=("bi", "rapport", "dashboard", "business intelligence", "analyse"),
        description_da="Rapporter og BI",
    ),
    TagCatalogEntryData(
        slug="telefon",
        label_da="Telefon",
        category="hardware",
        keywords=("telefon", "opkald", "softphone", "teams telefon"),
        description_da="Telefoni",
    ),
    TagCatalogEntryData(
        slug="it-support",
        label_da="IT-support",
        category="generel",
        keywords=("it-support", "generel", "hjælp", "support"),
        synonyms=("generel", "support"),
        description_da="Generel IT-support",
    ),
)
