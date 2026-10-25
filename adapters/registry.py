from __future__ import annotations
from .open_meteo_weather import OpenMeteoWeatherAdapter
from .nasa_gpm import NasaGpmAdapter
from .cwc_river import CwcRiverAdapter
from .open_meteo_flood import OpenMeteoFloodAdapter
from .tomtom_traffic import TomTomTrafficAdapter
from .delhi_transit import DelhiTransitAdapter
from .osm_roads import OsmRoadsAdapter
from .delhi_sldc import DelhiSldcAdapter
from .nasa_black_marble import NasaBlackMarbleAdapter
from .copernicus_gfm import CopernicusGfmAdapter
from .gdelt_news import GdeltNewsAdapter
from .telegram_citizen import TelegramCitizenAdapter
from .seattle_fire import SeattleFireAdapter
from .mumbai_mesonet import MumbaiMesonetAdapter

def build_adapters():
    return [
        OpenMeteoWeatherAdapter(), NasaGpmAdapter(), CwcRiverAdapter(),
        OpenMeteoFloodAdapter(), TomTomTrafficAdapter(), DelhiTransitAdapter(),
        OsmRoadsAdapter(), DelhiSldcAdapter(), NasaBlackMarbleAdapter(),
        CopernicusGfmAdapter(), GdeltNewsAdapter(), TelegramCitizenAdapter(),
        SeattleFireAdapter(), MumbaiMesonetAdapter(),
    ]
