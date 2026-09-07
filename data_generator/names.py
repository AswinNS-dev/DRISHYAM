"""Synthetic nomenclature pools.

All content here is fictional material generated for DRISHYAM's demo dataset.
District names and RTO codes are real because the Tamil Nadu heatmap (Leaflet +
india_districts.json) matches on them; every other string (people, gangs, areas,
streets, companies, banks) is invented content.
"""

# --------------------------------------------------------------------------
# Tamil Nadu districts (must match frontend/public/data/india_districts.json
# "district" strings so the map highlights them). Centre coords are approximate
# and get jittered when synthesizing locations.
# --------------------------------------------------------------------------
DISTRICTS = [
    ("Chennai", 13.0837, 80.2703),
    ("Chengalpattu", 12.7035, 79.9918),
    ("Kancheepuram", 12.8352, 79.7010),
    ("Thiruvallur", 13.1436, 79.9082),
    ("Vellore", 12.9165, 79.1325),
    ("Tiruvannamalai", 12.2264, 79.0741),
    ("Villupuram", 11.9398, 79.5027),
    ("Cuddalore", 11.7447, 79.7670),
    ("Salem", 11.6643, 78.1460),
    ("Namakkal", 11.2218, 78.1601),
    ("Dharmapuri", 12.1272, 78.1576),
    ("Erode", 11.3410, 77.7172),
    ("Coimbatore", 11.0168, 76.9558),
    ("Nilgiris", 11.4102, 76.6950),
    ("Tiruppur", 11.1085, 77.3411),
    ("Karur", 10.9601, 78.0767),
    ("Tiruchchirappalli", 10.7905, 78.7047),
    ("Perambalur", 11.2313, 78.8816),
    ("Ariyalur", 11.1395, 79.0753),
    ("Thanjavur", 10.7870, 79.1350),
    ("Pudukkottai", 10.3840, 78.8186),
    ("Sivaganga", 9.8470, 78.4834),
    ("Madurai", 9.9252, 78.1198),
    ("Theni", 10.0106, 77.4765),
    ("Virudhunagar", 9.5870, 77.9500),
    ("Ramanathapuram", 9.3720, 78.8410),
    ("Thoothukudi", 8.7139, 78.0679),
    ("Nagapattinam", 10.7716, 79.8440),
    ("Thiruvarur", 10.7720, 79.6368),
    ("Kanniyakumari", 8.0883, 77.5385),
]
DISTRICT_TO_COORD = {name: (lat, lon) for name, lat, lon in DISTRICTS}

# --------------------------------------------------------------------------
# Gang / criminal-group names (fictional)
# --------------------------------------------------------------------------
GANG_NAMES = [
    "Cobra Syndicate", "Silver Line Network", "Harbour Road Group",
    "North Star Outfit", "Red Sand Gang", "Delta Cartel", "Iron Wolf Syndicate",
    "Crimson Tide Group", "Black Lotus Network", "Eastern Arc Outfit",
    "Blue Orchid Cartel", "Steel Falcon Gang", "Night Harbor Syndicate",
    "Golden Key Network", "Shadow Line Outfit", "Radiant Moon Cartel",
    "Thunder Path Gang", "South Reach Syndicate", "Ashen Wolf Group",
    "Velvet Strike Cartel", "Cedar Ridge Gang", "Lotus Trail Gang",
    "Pixel Point Crew", "Marble Arch Syndicate", "Copper Fox Network",
    "Silk Route Cartel", "Banyan Row Outfit", "Iron Gate Gang",
    "Cloud Street Syndicate", "Mirage Fleet Cartel", "Ebony Owl Network",
    "Sunset Pier Mob", "Salt Edge Gang", "Drift Pickup Cartel",
    "Kite Lane Syndicate", "Rust Anchor Gang", "Grey Falcon Network",
    "Hollow Court Outfit",
]

# --------------------------------------------------------------------------
# Front / shell companies (fictional) that launder proceeds
# --------------------------------------------------------------------------
ORG_FRONT_NAMES = [
    "Coastal Freight Pvt Ltd", "Sunrise Traders", "Metro Logistics LLP",
    "Bluewave Shipping Co", "Kanchi Textiles", "Grand Bazaar Retail",
    "Sathiya Steel Corp", "Aarav Exports", "Nilgiri Foods Pvt Ltd",
    "Cauvery Agro Supplies", "Marina Impex", "Velan Spinning Mills",
    "Palani Gems Trading", "Southern Arc Builders", "Tandavam Automobiles",
    "Kaveri Fresh Exports", "Salem Agro Products", "Nellai Cold Storage",
    "Gemini Printworks", "Trichy Junction Cargo", "Bayline Fisheries Pvt Ltd",
    "Vikram Travels & Tours", "Thanjai Rice Mills", "Ravi Metal Traders",
    "Chola Ventures LLP", "Pandya Textile Exports", "Cheyyur Chemicals",
    "Periyar Paper Industries", "Sangam Constructions", "Vanchi Petro Traders",
    "Mullai Transport Co", "Kaveri Kitchenware", "Jupiter Refrigeration",
    "Orion Scrap Dealers", "Thoothukudi Port Logistics", "Kumar Industries",
    "Sona Jewels & Bullion", "Delta Agri Marketing", "Harbor Trade Links",
]

BANKS = [
    "HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank",
    "Canara Bank", "Kotak Mahindra Bank", "Indian Overseas Bank",
    "Tamilnad Mercantile Bank", "Federal Bank", "City Union Bank",
]

# --------------------------------------------------------------------------
# Crime taxonomy (aligned with the app's CRIME_TYPE keywords + filters)
# --------------------------------------------------------------------------
CRIME_TYPES = [
    "extortion", "smuggling", "narcotics trafficking", "robbery", "cybercrime",
    "money laundering", "murder", "vehicle theft", "counterfeiting",
    "kidnapping", "fraud",
]

CRIME_TYPE_PROFILES = {
    "extortion": {
        "sections": ["341 IPC", "387 IPC", "506(2) IPC", "Section 170 IPC"],
        "amount_range": (200000, 3500000),
        "evidence_kinds": ["CDR", "SURVEILLANCE", "FINANCIAL"],
    },
    "smuggling": {
        "sections": ["Section 135A Customs Act", "Section 418 IPC", "NDPS Act 23"],
        "amount_range": (1000000, 20000000),
        "evidence_kinds": ["SURVEILLANCE", "FINANCIAL", "CDR"],
    },
    "narcotics trafficking": {
        "sections": ["Section 8(c) NDPS", "Section 21 NDPS", "Section 27A NDPS"],
        "amount_range": (1500000, 12000000),
        "evidence_kinds": ["SURVEILLANCE", "CDR", "FINANCIAL"],
    },
    "robbery": {
        "sections": ["Section 392 IPC", "Section 397 IPC", "Section 506(2) IPC"],
        "amount_range": (300000, 6000000),
        "evidence_kinds": ["SURVEILLANCE", "CDR", "FINANCIAL"],
    },
    "cybercrime": {
        "sections": ["Section 66C IT Act", "Section 66D IT Act", "Section 420 IPC"],
        "amount_range": (100000, 5000000),
        "evidence_kinds": ["FINANCIAL", "CDR", "SURVEILLANCE"],
    },
    "money laundering": {
        "sections": ["Section 3 PMLA", "Section 4 PMLA", "Section 120B IPC"],
        "amount_range": (2000000, 50000000),
        "evidence_kinds": ["FINANCIAL", "CDR", "SURVEILLANCE"],
    },
    "murder": {
        "sections": ["Section 302 IPC", "Section 120B IPC", "Section 201 IPC"],
        "amount_range": (100000, 3000000),
        "evidence_kinds": ["SURVEILLANCE", "CDR", "FINANCIAL"],
    },
    "vehicle theft": {
        "sections": ["Section 379 IPC", "Section 411 IPC", "Section 120B IPC"],
        "amount_range": (150000, 2500000),
        "evidence_kinds": ["SURVEILLANCE", "CDR"],
    },
    "counterfeiting": {
        "sections": ["Section 489B IPC", "Section 489C IPC", "Section 420 IPC"],
        "amount_range": (500000, 8000000),
        "evidence_kinds": ["SURVEILLANCE", "FINANCIAL"],
    },
    "kidnapping": {
        "sections": ["Section 364 IPC", "Section 366 IPC", "Section 506(2) IPC"],
        "amount_range": (500000, 10000000),
        "evidence_kinds": ["CDR", "SURVEILLANCE", "FINANCIAL"],
    },
    "fraud": {
        "sections": ["Section 420 IPC", "Section 468 IPC", "Section 471 IPC"],
        "amount_range": (200000, 6000000),
        "evidence_kinds": ["FINANCIAL", "CDR"],
    },
}

# --------------------------------------------------------------------------
# Vehicles
# --------------------------------------------------------------------------
VEHICLE_TYPES = [
    ("motorcycle", 0.30), ("sedan", 0.18), ("SUV", 0.15), ("truck", 0.12),
    ("lorry", 0.08), ("van", 0.07), ("autorickshaw", 0.05), ("bus", 0.03),
    ("pickup", 0.02),
]
VEHICLE_COLORS = [
    "white", "black", "silver", "blue", "red", "grey", "maroon",
    "green", "gold", "brown",
]
# district -> RTO series prefix (e.g. TN-09, TN-38) map for realistic plates
RTO_BY_DISTRICT = {
    "Chennai": "01", "Chengalpattu": "19", "Kancheepuram": "21",
    "Thiruvallur": "20", "Vellore": "23", "Tiruvannamalai": "25",
    "Villupuram": "32", "Cuddalore": "31", "Salem": "27", "Namakkal": "28",
    "Dharmapuri": "30", "Erode": "34", "Coimbatore": "38", "Nilgiris": "43",
    "Tiruppur": "39", "Karur": "47", "Tiruchchirappalli": "45",
    "Perambalur": "46", "Ariyalur": "46", "Thanjavur": "49",
    "Pudukkottai": "55", "Sivaganga": "63", "Madurai": "58", "Theni": "64",
    "Virudhunagar": "60", "Ramanathapuram": "62", "Thoothukudi": "69",
    "Nagapattinam": "51", "Thiruvarur": "50", "Kanniyakumari": "75",
}

# --------------------------------------------------------------------------
# Narrative building blocks (fictional areas / places / roads)
# --------------------------------------------------------------------------
AREA_NAMES = [
    "Anna Nagar", "KK Nagar", "Arumbakkam", "Velachery", "Porur", "Ambattur",
    "Chromepet", "Tambaram", "Adyar", "Washermenpet", "Egmore", "Royapuram",
    "Mylapore", "Gandhipuram", "RS Puram", "Sulur", "Ganapathy",
    "Pappanaickenpalayam", "Kajamalai", "Thirunagar", "Mattuthavani",
    "Vilachery", "Arappalayam", "New Bus Stand", "Ammapet", "Kallamadu",
    "Sundarankottai", "Keezhakkarai", "Palayamkottai", "Mettupalayam",
    "Palladam", "Ukkadam", "Peelamedu", "Coimbatore Junction", "Singanallur",
    "Nellithope", "Muthialpet", "Vinoba Nagar", "Sowdambika Layout",
    "Pothigai Nagar", "Valluvar Layout", "Meenakshi Nagar", "Bharathi Bazaar",
    "Madurai Junction", "Azhagar Koil Road", "Chokkanadar Pettai",
    "Kuruvikulam", "Estancia", "Vadapalani", "Garuda Mall Corridor",
]

PLACE_SUFFIXES = [
    "Junction", "Godown Compound", "Wholesale Market", "Bus Terminus",
    "Railway Yard", "Lorry Park", "Industrial Estate", "Toll Plaza",
    "Check Post", "Mandi", "Cold Storage", "Warehouse Complex",
    "Harbour Gate", "Fish Market", "Oil Depot", "Construction Site",
    "Textile Mill", "Agro Market", "Residential Layout", "Night Bazaar",
    "Relay Station", "Fuel Station", "Bridge End", "Outer Ring Road",
]

STREET_NAMES = [
    "Main Road", "Double Road", "5th Cross", "Market Street", "Church Street",
    "Dharmapuri Road", "North Car Street", "South Mada Street", "Eruvadi Road",
    "Bypass Road", "Service Lane", "Harbour Approach Road", "Ghat Road",
    "High Court Road", "Anna Salai", "Kamraj Road", "Nethaji Road",
    "Periyar Road", "Load Road", "Railway Station Road",
]

PS_SUFFIXES = ["Police Station", "City Police Station", "North Police Station", "Harbour Police Station"]

# Cooperating synthetic constables/officer names used in narratives/audit logs
OFFICER_NAMES = [
    "Inspector Karthik Raghavan", "Inspector Deepa Nanduri",
    "SI Ramesh Babu", "SI Priya Darshan", "CI Sandeep Kumar",
    "Special Sub-Inspector Emmanuel", "ACP Rajesh Menon",
    "Dy. SP Arjun Sridhar",
]