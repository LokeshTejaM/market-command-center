"""Sector ETFs, index benchmarks, and industry group ETFs.

Static reference data. GICS-aligned sector ETFs come in two families:
    * SPDR cap-weighted:  XLK, XLY, XLC, XLF, XLP, XLV, XLI, XLE, XLU, XLB, XLRE
    * Invesco equal-wt:   RSPT, RSPD, RSPC, RSPF, RSPS, RSPH, RSPN, RSPG, RSPU, RSPM, RSPR

Equal-weight vs cap-weight divergence is a leading breadth signal: RSP > SPY
means broad rally; RSP << SPY means a few mega-caps carrying a weak market.
"""

# Broad-market benchmarks. SPY is THE benchmark for RS calcs.
BENCHMARKS = [
    ("SPY", "S&P 500", "benchmark"),
    ("RSP", "S&P 500 Equal Weight", "benchmark"),
    ("QQQ", "Nasdaq 100", "benchmark"),
    ("QQQE", "Nasdaq 100 Equal Weight", "benchmark"),
    ("IWM", "Russell 2000", "benchmark"),
    ("DIA", "Dow Jones", "benchmark"),
]

# GICS sector -> (cap-weight ETF, equal-weight ETF)
# Maps to the same sector strings Wikipedia uses in the S&P 500 table.
SECTOR_ETFS = {
    "Information Technology":   ("XLK",  "RSPT"),
    "Consumer Discretionary":   ("XLY",  "RSPD"),
    "Communication Services":   ("XLC",  "RSPC"),
    "Financials":               ("XLF",  "RSPF"),
    "Consumer Staples":         ("XLP",  "RSPS"),
    "Health Care":              ("XLV",  "RSPH"),
    "Industrials":              ("XLI",  "RSPN"),
    "Energy":                   ("XLE",  "RSPG"),
    "Utilities":                ("XLU",  "RSPU"),
    "Materials":                ("XLB",  "RSPM"),
    "Real Estate":              ("XLRE", "RSPR"),
}

# Volatility & inter-market instruments -- essential context for momentum trading.
VOLATILITY = [
    ("^VIX",  "VIX",         "volatility"),
    ("^VIX3M", "VIX3M",       "volatility"),
]

INTERMARKET = [
    ("TLT", "20+ Year Treasury",       "bonds"),
    ("HYG", "High Yield Corp Bonds",   "bonds"),
    ("LQD", "Investment Grade Bonds",  "bonds"),
    ("UUP", "US Dollar Index",         "fx"),
    ("GLD", "Gold",                    "commodity"),
    ("USO", "Crude Oil",               "commodity"),
]

# Industry-group ETFs -- Jeff Sun's preferred granularity for tracking rotation
# between narrow themes (semis vs software, banks vs insurance, homebuilders
# vs materials, etc). All Equal-Weight where available (Jeff's preference).
# Categorized so we can group them in the UI.
INDUSTRY_ETFS = [
    # Technology sub-industries
    ("XSD",  "Semiconductors (EW)",         "industry_tech"),
    ("SMH",  "Semiconductors (CW)",         "industry_tech"),
    ("IGV",  "Software",                    "industry_tech"),
    ("CIBR", "Cybersecurity",               "industry_tech"),
    ("FDN",  "Internet",                    "industry_tech"),
    ("WCLD", "Cloud Computing",             "industry_tech"),
    ("AIQ",  "AI & Big Data",               "industry_tech"),
    ("ROBO", "Robotics & Automation",       "industry_tech"),
    # Financials sub-industries
    ("KRE",  "Regional Banks (EW)",         "industry_fin"),
    ("KBE",  "Banks",                       "industry_fin"),
    ("KIE",  "Insurance",                   "industry_fin"),
    ("KCE",  "Capital Markets",             "industry_fin"),
    ("IAI",  "Broker-Dealers",              "industry_fin"),
    # Health Care sub-industries
    ("XBI",  "Biotech (EW)",                "industry_hc"),
    ("IBB",  "Biotech (CW)",                "industry_hc"),
    ("IHI",  "Medical Devices",             "industry_hc"),
    ("XPH",  "Pharma",                      "industry_hc"),
    ("PPH",  "Pharma (VanEck)",             "industry_hc"),
    # Consumer & Retail
    ("XRT",  "Retail (EW)",                 "industry_cons"),
    ("IBUY", "Online Retail",               "industry_cons"),
    ("PEJ",  "Leisure & Entertainment",     "industry_cons"),
    ("XHB",  "Homebuilders",                "industry_cons"),
    ("ITB",  "Home Construction",           "industry_cons"),
    ("JETS", "Airlines",                    "industry_cons"),
    # Industrials & Infrastructure
    ("ITA",  "Aerospace & Defense",         "industry_indus"),
    ("PAVE", "US Infrastructure",           "industry_indus"),
    ("XTN",  "Transportation",              "industry_indus"),
    # Energy & Materials
    ("XOP",  "Oil & Gas Exploration (EW)",  "industry_ener"),
    ("OIH",  "Oil Services",                "industry_ener"),
    ("XES",  "Oil Equipment & Services",    "industry_ener"),
    ("URA",  "Uranium",                     "industry_ener"),
    ("TAN",  "Solar",                       "industry_ener"),
    ("ICLN", "Clean Energy",                "industry_ener"),
    ("GDX",  "Gold Miners",                 "industry_ener"),
    ("SIL",  "Silver Miners",               "industry_ener"),
    ("XME",  "Metals & Mining",             "industry_ener"),
    ("LIT",  "Lithium & Battery",           "industry_ener"),
    ("COPX", "Copper Miners",               "industry_ener"),
    # Real Estate
    ("VNQ",  "US REITs",                    "industry_re"),
    ("REZ",  "Residential REITs",           "industry_re"),
    # Crypto-adjacent (thematic momentum plays)
    ("IBIT", "Bitcoin ETF",                 "industry_crypto"),
    ("WGMI", "Bitcoin Miners",              "industry_crypto"),
    ("BLOK", "Blockchain",                  "industry_crypto"),
]


def all_sector_etfs():
    """Flattened list of (ticker, name, category) for every sector ETF."""
    out = []
    for sector, (cw, ew) in SECTOR_ETFS.items():
        out.append((cw, f"{sector} (CW)", "sector_cw"))
        out.append((ew, f"{sector} (EW)", "sector_ew"))
    return out


def all_reference_tickers():
    """Every non-stock ticker we need to fetch: benchmarks + sectors + industry + vol + intermarket."""
    return (
        BENCHMARKS
        + all_sector_etfs()
        + INDUSTRY_ETFS
        + VOLATILITY
        + INTERMARKET
    )
