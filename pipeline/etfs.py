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


def all_sector_etfs():
    """Flattened list of (ticker, name, category) for every sector ETF."""
    out = []
    for sector, (cw, ew) in SECTOR_ETFS.items():
        out.append((cw, f"{sector} (CW)", "sector_cw"))
        out.append((ew, f"{sector} (EW)", "sector_ew"))
    return out


def all_reference_tickers():
    """Every non-stock ticker we need to fetch: benchmarks + sectors + vol + intermarket."""
    return (
        BENCHMARKS
        + all_sector_etfs()
        + VOLATILITY
        + INTERMARKET
    )
