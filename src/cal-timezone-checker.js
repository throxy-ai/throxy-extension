// Cal.com Phone ↔ Timezone Mismatch Warning
// Flags when the phone country code doesn't match the selected timezone
// For +1 (US/CA) numbers, validates at the area code level

(function () {
  "use strict";

  const BANNER_ID = "throxy-tz-mismatch-banner";

  // North American (+1) area code → IANA timezones
  const AREA_CODE_TO_TIMEZONES = {
    "201":["America/New_York"],"202":["America/New_York"],"203":["America/New_York"],
    "204":["America/Winnipeg"],"205":["America/Chicago"],"206":["America/Los_Angeles"],
    "207":["America/New_York"],"208":["America/Boise","America/Los_Angeles"],
    "209":["America/Los_Angeles"],"210":["America/Chicago"],"212":["America/New_York"],
    "213":["America/Los_Angeles"],"214":["America/Chicago"],"215":["America/New_York"],
    "216":["America/New_York"],"217":["America/Chicago"],"218":["America/Chicago"],
    "219":["America/Chicago"],"220":["America/New_York"],"223":["America/New_York"],
    "224":["America/Chicago"],"225":["America/Chicago"],"226":["America/Toronto"],
    "227":["America/New_York"],"228":["America/Chicago"],"229":["America/New_York"],
    "231":["America/New_York"],"234":["America/New_York"],"235":["America/Chicago"],
    "236":["America/Vancouver"],"239":["America/New_York"],"240":["America/New_York"],
    "242":["America/Nassau"],"246":["America/Barbados"],"248":["America/New_York"],
    "249":["America/Toronto"],"250":["America/Vancouver"],"251":["America/Chicago"],
    "252":["America/New_York"],"253":["America/Los_Angeles"],"254":["America/Chicago"],
    "256":["America/Chicago"],"257":["America/Vancouver"],"260":["America/Indiana/Indianapolis"],
    "262":["America/Chicago"],"263":["America/Toronto"],"264":["America/Anguilla"],
    "267":["America/New_York"],"268":["America/Antigua"],"269":["America/New_York"],
    "270":["America/Chicago","America/New_York"],"272":["America/New_York"],
    "274":["America/Chicago"],"276":["America/New_York"],"279":["America/Los_Angeles"],
    "281":["America/Chicago"],"283":["America/New_York"],"284":["America/Tortola"],
    "289":["America/Toronto"],"301":["America/New_York"],"302":["America/New_York"],
    "303":["America/Denver"],"304":["America/New_York"],"305":["America/New_York"],
    "306":["America/Regina"],"307":["America/Denver"],"308":["America/Chicago","America/Denver"],
    "309":["America/Chicago"],"310":["America/Los_Angeles"],"312":["America/Chicago"],
    "313":["America/New_York"],"314":["America/Chicago"],"315":["America/New_York"],
    "316":["America/Chicago"],"317":["America/Indiana/Indianapolis"],"318":["America/Chicago"],
    "319":["America/Chicago"],"320":["America/Chicago"],"321":["America/New_York"],
    "323":["America/Los_Angeles"],"324":["America/New_York"],"325":["America/Chicago"],
    "326":["America/New_York"],"327":["America/Chicago"],"329":["America/New_York"],
    "330":["America/New_York"],"331":["America/Chicago"],"332":["America/New_York"],
    "334":["America/Chicago"],"336":["America/New_York"],"337":["America/Chicago"],
    "339":["America/New_York"],"340":["America/Virgin"],"341":["America/Los_Angeles"],
    "343":["America/Toronto"],"345":["America/Cayman"],"346":["America/Chicago"],
    "347":["America/New_York"],"350":["America/Los_Angeles"],"351":["America/New_York"],
    "352":["America/New_York"],"353":["America/Chicago"],"354":["America/Toronto"],
    "357":["America/Los_Angeles"],"360":["America/Los_Angeles"],"361":["America/Chicago"],
    "363":["America/New_York"],"364":["America/Chicago","America/New_York"],
    "365":["America/Toronto"],"367":["America/Toronto"],"368":["America/Edmonton"],
    "369":["America/Los_Angeles"],"380":["America/New_York"],"382":["America/Toronto"],
    "385":["America/Denver"],"386":["America/New_York"],"401":["America/New_York"],
    "402":["America/Chicago"],"403":["America/Edmonton"],"404":["America/New_York"],
    "405":["America/Chicago"],"406":["America/Denver"],"407":["America/New_York"],
    "408":["America/Los_Angeles"],"409":["America/Chicago"],"410":["America/New_York"],
    "412":["America/New_York"],"413":["America/New_York"],"414":["America/Chicago"],
    "415":["America/Los_Angeles"],"416":["America/Toronto"],"417":["America/Chicago"],
    "418":["America/Toronto"],"419":["America/New_York"],"423":["America/New_York","America/Chicago"],
    "424":["America/Los_Angeles"],"425":["America/Los_Angeles"],"428":["America/Moncton"],
    "430":["America/Chicago"],"431":["America/Winnipeg"],"432":["America/Chicago"],
    "434":["America/New_York"],"435":["America/Denver"],"436":["America/New_York"],
    "437":["America/Toronto"],"438":["America/Toronto"],"440":["America/New_York"],
    "441":["Atlantic/Bermuda"],"442":["America/Los_Angeles"],"443":["America/New_York"],
    "445":["America/New_York"],"447":["America/Chicago"],"448":["America/New_York","America/Chicago"],
    "450":["America/Toronto"],"457":["America/Chicago"],"458":["America/Los_Angeles","America/Boise"],
    "463":["America/Indiana/Indianapolis"],"464":["America/Chicago"],"468":["America/Toronto"],
    "469":["America/Chicago"],"470":["America/New_York"],"471":["America/Chicago"],
    "472":["America/New_York"],"473":["America/Grenada"],"474":["America/Regina"],
    "475":["America/New_York"],"478":["America/New_York"],"479":["America/Chicago"],
    "480":["America/Phoenix"],"483":["America/Chicago"],"484":["America/New_York"],
    "501":["America/Chicago"],"502":["America/New_York"],"503":["America/Los_Angeles"],
    "504":["America/Chicago"],"505":["America/Denver"],"506":["America/Moncton"],
    "507":["America/Chicago"],"508":["America/New_York"],"509":["America/Los_Angeles"],
    "510":["America/Los_Angeles"],"512":["America/Chicago"],"513":["America/New_York"],
    "514":["America/Toronto"],"515":["America/Chicago"],"516":["America/New_York"],
    "517":["America/New_York"],"518":["America/New_York"],"519":["America/Toronto"],
    "520":["America/Phoenix"],"530":["America/Los_Angeles"],"531":["America/Chicago"],
    "534":["America/Chicago"],"539":["America/Chicago"],"540":["America/New_York"],
    "541":["America/Los_Angeles","America/Boise"],"548":["America/Toronto"],
    "551":["America/New_York"],"557":["America/Chicago"],"559":["America/Los_Angeles"],
    "561":["America/New_York"],"562":["America/Los_Angeles"],"563":["America/Chicago"],
    "564":["America/Los_Angeles"],"567":["America/New_York"],"570":["America/New_York"],
    "571":["America/New_York"],"572":["America/Chicago"],"573":["America/Chicago"],
    "574":["America/Indiana/Indianapolis","America/Chicago"],"575":["America/Denver"],
    "579":["America/Toronto"],"580":["America/Chicago"],"581":["America/Toronto"],
    "582":["America/New_York"],"584":["America/Winnipeg"],"585":["America/New_York"],
    "586":["America/New_York"],"587":["America/Edmonton"],"601":["America/Chicago"],
    "602":["America/Phoenix"],"603":["America/New_York"],"604":["America/Vancouver"],
    "605":["America/Chicago","America/Denver"],"606":["America/New_York"],
    "607":["America/New_York"],"608":["America/Chicago"],"609":["America/New_York"],
    "610":["America/New_York"],"612":["America/Chicago"],"613":["America/Toronto"],
    "614":["America/New_York"],"615":["America/Chicago"],"616":["America/New_York"],
    "617":["America/New_York"],"618":["America/Chicago"],"619":["America/Los_Angeles"],
    "620":["America/Chicago","America/Denver"],"621":["America/Chicago"],
    "623":["America/Phoenix"],"624":["America/New_York"],"626":["America/Los_Angeles"],
    "628":["America/Los_Angeles"],"629":["America/Chicago"],"630":["America/Chicago"],
    "631":["America/New_York"],"636":["America/Chicago"],"639":["America/Regina"],
    "640":["America/New_York"],"641":["America/Chicago"],"645":["America/New_York"],
    "646":["America/New_York"],"647":["America/Toronto"],"649":["America/Grand_Turk"],
    "650":["America/Los_Angeles"],"651":["America/Chicago"],"656":["America/New_York"],
    "657":["America/Los_Angeles"],"658":["America/Jamaica"],"659":["America/Chicago"],
    "660":["America/Chicago"],"661":["America/Los_Angeles"],"662":["America/Chicago"],
    "664":["America/Montserrat"],"667":["America/New_York"],"669":["America/Los_Angeles"],
    "670":["Pacific/Guam"],"671":["Pacific/Guam"],"672":["America/Vancouver"],
    "678":["America/New_York"],"679":["America/New_York"],"680":["America/New_York"],
    "681":["America/New_York"],"682":["America/Chicago"],"683":["America/Toronto"],
    "684":["Pacific/Pago_Pago"],"686":["America/New_York"],"689":["America/New_York"],
    "701":["America/Chicago","America/Denver"],"702":["America/Los_Angeles"],
    "703":["America/New_York"],"704":["America/New_York"],"705":["America/Toronto"],
    "706":["America/New_York"],"707":["America/Los_Angeles"],"708":["America/Chicago"],
    "709":["America/St_Johns"],"712":["America/Chicago"],"713":["America/Chicago"],
    "714":["America/Los_Angeles"],"715":["America/Chicago"],"716":["America/New_York"],
    "717":["America/New_York"],"718":["America/New_York"],"719":["America/Denver"],
    "720":["America/Denver"],"721":["America/Lower_Princes"],"724":["America/New_York"],
    "725":["America/Los_Angeles"],"726":["America/Chicago"],"727":["America/New_York"],
    "728":["America/New_York"],"729":["America/New_York","America/Chicago"],
    "730":["America/Chicago"],"731":["America/Chicago"],"732":["America/New_York"],
    "734":["America/New_York"],"737":["America/Chicago"],"738":["America/Los_Angeles"],
    "740":["America/New_York"],"742":["America/Toronto"],"743":["America/New_York"],
    "747":["America/Los_Angeles"],"748":["America/Denver"],"753":["America/Toronto"],
    "754":["America/New_York"],"757":["America/New_York"],"758":["America/St_Lucia"],
    "760":["America/Los_Angeles"],"762":["America/New_York"],"763":["America/Chicago"],
    "765":["America/Indiana/Indianapolis"],"767":["America/Dominica"],
    "769":["America/Chicago"],"770":["America/New_York"],"771":["America/New_York"],
    "772":["America/New_York"],"773":["America/Chicago"],"774":["America/New_York"],
    "775":["America/Los_Angeles"],"778":["America/Vancouver"],"779":["America/Chicago"],
    "780":["America/Edmonton"],"781":["America/New_York"],"782":["America/Halifax"],
    "784":["America/St_Vincent"],"785":["America/Chicago","America/Denver"],
    "786":["America/New_York"],"787":["America/Puerto_Rico"],"801":["America/Denver"],
    "802":["America/New_York"],"803":["America/New_York"],"804":["America/New_York"],
    "805":["America/Los_Angeles"],"806":["America/Chicago"],
    "807":["America/Thunder_Bay","America/Rainy_River"],"808":["Pacific/Honolulu"],
    "809":["America/Santo_Domingo"],"810":["America/New_York"],
    "812":["America/Indiana/Indianapolis","America/Indiana/Tell_City"],
    "813":["America/New_York"],"814":["America/New_York"],"815":["America/Chicago"],
    "816":["America/Chicago"],"817":["America/Chicago"],"818":["America/Los_Angeles"],
    "819":["America/Toronto"],"820":["America/Los_Angeles"],"821":["America/New_York"],
    "825":["America/Edmonton"],"826":["America/New_York"],"828":["America/New_York"],
    "829":["America/Santo_Domingo"],"830":["America/Chicago"],"831":["America/Los_Angeles"],
    "832":["America/Chicago"],"835":["America/New_York"],"837":["America/Los_Angeles"],
    "838":["America/New_York"],"839":["America/New_York"],"840":["America/Los_Angeles"],
    "843":["America/New_York"],"845":["America/New_York"],"847":["America/Chicago"],
    "848":["America/New_York"],"849":["America/Santo_Domingo"],
    "850":["America/New_York","America/Chicago"],"854":["America/New_York"],
    "856":["America/New_York"],"857":["America/New_York"],"858":["America/Los_Angeles"],
    "859":["America/New_York"],"860":["America/New_York"],"861":["America/Chicago"],
    "862":["America/New_York"],"863":["America/New_York"],"864":["America/New_York"],
    "865":["America/New_York"],
    "867":["America/Whitehorse","America/Yellowknife","America/Iqaluit","America/Dawson","America/Inuvik","America/Cambridge_Bay","America/Rankin_Inlet","America/Resolute"],
    "868":["America/Port_of_Spain"],"869":["America/St_Kitts"],"870":["America/Chicago"],
    "872":["America/Chicago"],"873":["America/Toronto"],"876":["America/Jamaica"],
    "878":["America/New_York"],"879":["America/St_Johns"],"901":["America/Chicago"],
    "902":["America/Halifax"],"903":["America/Chicago"],"904":["America/New_York"],
    "905":["America/Toronto"],"906":["America/New_York","America/Menominee"],
    "907":["America/Anchorage","America/Juneau","America/Sitka","America/Yakutat","America/Nome","America/Metlakatla","America/Adak"],
    "908":["America/New_York"],"909":["America/Los_Angeles"],"910":["America/New_York"],
    "912":["America/New_York"],"913":["America/Chicago"],"914":["America/New_York"],
    "915":["America/Denver"],"916":["America/Los_Angeles"],"917":["America/New_York"],
    "918":["America/Chicago"],"919":["America/New_York"],"920":["America/Chicago"],
    "924":["America/Chicago"],"925":["America/Los_Angeles"],"928":["America/Phoenix"],
    "929":["America/New_York"],"930":["America/Indiana/Indianapolis","America/Indiana/Tell_City"],
    "931":["America/Chicago","America/New_York"],"934":["America/New_York"],
    "936":["America/Chicago"],"937":["America/New_York"],"938":["America/Chicago"],
    "939":["America/Puerto_Rico"],"940":["America/Chicago"],"941":["America/New_York"],
    "942":["America/Toronto"],"943":["America/New_York"],"945":["America/Chicago"],
    "947":["America/New_York"],"948":["America/New_York"],"949":["America/Los_Angeles"],
    "951":["America/Los_Angeles"],"952":["America/Chicago"],"954":["America/New_York"],
    "956":["America/Chicago"],"959":["America/New_York"],"970":["America/Denver"],
    "971":["America/Los_Angeles"],"972":["America/Chicago"],"973":["America/New_York"],
    "975":["America/Chicago"],"978":["America/New_York"],"979":["America/Chicago"],
    "980":["America/New_York"],"983":["America/Denver"],"984":["America/New_York"],
    "985":["America/Chicago"],"986":["America/Boise","America/Los_Angeles"],
    "989":["America/New_York"],
  };

  // Toll-free codes (no geographic association, skip check)
  const TOLL_FREE = new Set(["800","833","844","855","866","877","888"]);

  // Calling code → list of ISO country codes (non +1)
  const CALLING_CODE_TO_COUNTRIES = {
    "7": ["RU","KZ"],
    "20": ["EG"], "27": ["ZA"], "30": ["GR"], "31": ["NL"], "32": ["BE"], "33": ["FR"],
    "34": ["ES"], "36": ["HU"], "39": ["IT"], "40": ["RO"], "41": ["CH"], "43": ["AT"],
    "44": ["GB","JE","GG","IM"], "45": ["DK"], "46": ["SE"], "47": ["NO","SJ"], "48": ["PL"],
    "49": ["DE"], "51": ["PE"], "52": ["MX"], "53": ["CU"], "54": ["AR"], "55": ["BR"],
    "56": ["CL"], "57": ["CO"], "58": ["VE"], "60": ["MY"], "61": ["AU","CX","CC"],
    "62": ["ID"], "63": ["PH"], "64": ["NZ"], "65": ["SG"], "66": ["TH"], "81": ["JP"],
    "82": ["KR"], "84": ["VN"], "86": ["CN"], "90": ["TR"], "91": ["IN"], "92": ["PK"],
    "93": ["AF"], "94": ["LK"], "95": ["MM"], "98": ["IR"],
    "212": ["MA"], "213": ["DZ"], "216": ["TN"], "218": ["LY"],
    "220": ["GM"], "221": ["SN"], "222": ["MR"], "223": ["ML"], "224": ["GN"],
    "225": ["CI"], "226": ["BF"], "227": ["NE"], "228": ["TG"], "229": ["BJ"],
    "230": ["MU"], "231": ["LR"], "232": ["SL"], "233": ["GH"], "234": ["NG"],
    "235": ["TD"], "236": ["CF"], "237": ["CM"], "238": ["CV"], "239": ["ST"],
    "240": ["GQ"], "241": ["GA"], "242": ["CG"], "243": ["CD"], "244": ["AO"],
    "245": ["GW"], "246": ["IO"], "247": ["AC"], "248": ["SC"], "249": ["SD"],
    "250": ["RW"], "251": ["ET"], "252": ["SO"], "253": ["DJ"], "254": ["KE"],
    "255": ["TZ"], "256": ["UG"], "257": ["BI"], "258": ["MZ"],
    "260": ["ZM"], "261": ["MG"], "262": ["RE","YT"], "263": ["ZW"], "264": ["NA"],
    "265": ["MW"], "266": ["LS"], "267": ["BW"], "268": ["SZ"], "269": ["KM"],
    "290": ["SH"], "291": ["ER"], "297": ["AW"], "298": ["FO"], "299": ["GL"],
    "350": ["GI"], "351": ["PT"], "352": ["LU"], "353": ["IE"], "354": ["IS"],
    "355": ["AL"], "356": ["MT"], "357": ["CY"], "358": ["FI","AX"], "359": ["BG"],
    "370": ["LT"], "371": ["LV"], "372": ["EE"], "373": ["MD"], "374": ["AM"],
    "375": ["BY"], "376": ["AD"], "377": ["MC"], "378": ["SM"], "380": ["UA"],
    "381": ["RS"], "382": ["ME"], "383": ["XK"], "385": ["HR"], "386": ["SI"],
    "387": ["BA"], "389": ["MK"],
    "420": ["CZ"], "421": ["SK"],
    "500": ["FK"], "501": ["BZ"], "502": ["GT"], "503": ["SV"], "504": ["HN"],
    "505": ["NI"], "506": ["CR"], "507": ["PA"], "508": ["PM"], "509": ["HT"],
    "590": ["GP","BL","MF"], "591": ["BO"], "592": ["GY"], "593": ["EC"],
    "594": ["GF"], "595": ["PY"], "596": ["MQ"], "597": ["SR"], "598": ["UY"],
    "599": ["CW","BQ"],
    "670": ["TL"], "672": ["NF"], "673": ["BN"], "674": ["NR"], "675": ["PG"],
    "676": ["TO"], "677": ["SB"], "678": ["VU"], "679": ["FJ"], "680": ["PW"],
    "681": ["WF"], "682": ["CK"], "683": ["NU"], "685": ["WS"], "686": ["KI"],
    "687": ["NC"], "688": ["TV"], "689": ["PF"], "690": ["TK"], "691": ["FM"],
    "692": ["MH"],
    "850": ["KP"], "852": ["HK"], "853": ["MO"], "855": ["KH"], "856": ["LA"],
    "880": ["BD"], "886": ["TW"],
    "960": ["MV"], "961": ["LB"], "962": ["JO"], "963": ["SY"], "964": ["IQ"],
    "965": ["KW"], "966": ["SA"], "967": ["YE"], "968": ["OM"], "970": ["PS"],
    "971": ["AE"], "972": ["IL"], "973": ["BH"], "974": ["QA"], "975": ["BT"],
    "976": ["MN"], "977": ["NP"],
    "992": ["TJ"], "993": ["TM"], "994": ["AZ"], "995": ["GE"], "996": ["KG"],
    "998": ["UZ"],
  };

  // ISO country code → list of valid IANA timezones
  const COUNTRY_TO_TIMEZONES = {
    GB: ["Europe/London"], IE: ["Europe/Dublin"], FR: ["Europe/Paris"], DE: ["Europe/Berlin"],
    ES: ["Europe/Madrid","Atlantic/Canary"], PT: ["Europe/Lisbon","Atlantic/Madeira","Atlantic/Azores"],
    IT: ["Europe/Rome"], NL: ["Europe/Amsterdam"], BE: ["Europe/Brussels"], CH: ["Europe/Zurich"],
    AT: ["Europe/Vienna"], SE: ["Europe/Stockholm"], NO: ["Europe/Oslo"], DK: ["Europe/Copenhagen"],
    FI: ["Europe/Helsinki"], PL: ["Europe/Warsaw"], CZ: ["Europe/Prague"], SK: ["Europe/Bratislava"],
    HU: ["Europe/Budapest"], RO: ["Europe/Bucharest"], BG: ["Europe/Sofia"], GR: ["Europe/Athens"],
    TR: ["Europe/Istanbul"],
    RU: ["Europe/Moscow","Europe/Kaliningrad","Europe/Samara","Europe/Volgograd","Asia/Yekaterinburg","Asia/Omsk","Asia/Novosibirsk","Asia/Barnaul","Asia/Tomsk","Asia/Novokuznetsk","Asia/Krasnoyarsk","Asia/Irkutsk","Asia/Chita","Asia/Yakutsk","Asia/Khandyga","Asia/Vladivostok","Asia/Ust-Nera","Asia/Magadan","Asia/Sakhalin","Asia/Srednekolymsk","Asia/Kamchatka","Asia/Anadyr","Europe/Kirov","Europe/Astrakhan","Europe/Ulyanovsk","Europe/Saratov"],
    UA: ["Europe/Kiev","Europe/Kyiv"], BY: ["Europe/Minsk"],
    LT: ["Europe/Vilnius"], LV: ["Europe/Riga"], EE: ["Europe/Tallinn"],
    HR: ["Europe/Zagreb"], SI: ["Europe/Ljubljana"], RS: ["Europe/Belgrade"],
    BA: ["Europe/Sarajevo"], ME: ["Europe/Podgorica"], MK: ["Europe/Skopje"],
    AL: ["Europe/Tirane"], MD: ["Europe/Chisinau"], AM: ["Asia/Yerevan"],
    GE: ["Asia/Tbilisi"], AZ: ["Asia/Baku"],
    KZ: ["Asia/Almaty","Asia/Aqtau","Asia/Aqtobe","Asia/Atyrau","Asia/Oral","Asia/Qostanay","Asia/Qyzylorda"],
    UZ: ["Asia/Tashkent","Asia/Samarkand"], TJ: ["Asia/Dushanbe"], TM: ["Asia/Ashgabat"], KG: ["Asia/Bishkek"],
    IN: ["Asia/Kolkata","Asia/Calcutta"], PK: ["Asia/Karachi"], BD: ["Asia/Dhaka"],
    LK: ["Asia/Colombo"], NP: ["Asia/Kathmandu"], MM: ["Asia/Yangon","Asia/Rangoon"],
    TH: ["Asia/Bangkok"], VN: ["Asia/Ho_Chi_Minh","Asia/Saigon"], KH: ["Asia/Phnom_Penh"],
    LA: ["Asia/Vientiane"], MY: ["Asia/Kuala_Lumpur","Asia/Kuching"], SG: ["Asia/Singapore"],
    ID: ["Asia/Jakarta","Asia/Pontianak","Asia/Makassar","Asia/Jayapura"], PH: ["Asia/Manila"],
    CN: ["Asia/Shanghai","Asia/Urumqi"], HK: ["Asia/Hong_Kong"], MO: ["Asia/Macau"],
    TW: ["Asia/Taipei"], JP: ["Asia/Tokyo"], KR: ["Asia/Seoul"], KP: ["Asia/Pyongyang"],
    MN: ["Asia/Ulaanbaatar","Asia/Hovd","Asia/Choibalsan"],
    AU: ["Australia/Sydney","Australia/Melbourne","Australia/Brisbane","Australia/Perth","Australia/Adelaide","Australia/Hobart","Australia/Darwin","Australia/Currie","Australia/Lindeman","Australia/Lord_Howe","Australia/Eucla","Australia/Broken_Hill","Antarctica/Macquarie"],
    NZ: ["Pacific/Auckland","Pacific/Chatham"], FJ: ["Pacific/Fiji"],
    PG: ["Pacific/Port_Moresby","Pacific/Bougainville"], SB: ["Pacific/Guadalcanal"],
    NC: ["Pacific/Noumea"], VU: ["Pacific/Efate"], WS: ["Pacific/Apia"],
    TO: ["Pacific/Tongatapu"], KI: ["Pacific/Tarawa","Pacific/Kanton","Pacific/Kiritimati"],
    MH: ["Pacific/Majuro","Pacific/Kwajalein"], FM: ["Pacific/Chuuk","Pacific/Pohnpei","Pacific/Kosrae"],
    PW: ["Pacific/Palau"], NR: ["Pacific/Nauru"], TV: ["Pacific/Funafuti"],
    CK: ["Pacific/Rarotonga"], PF: ["Pacific/Tahiti","Pacific/Marquesas","Pacific/Gambier"],
    MX: ["America/Mexico_City","America/Cancun","America/Merida","America/Monterrey","America/Matamoros","America/Chihuahua","America/Ciudad_Juarez","America/Ojinaga","America/Mazatlan","America/Bahia_Banderas","America/Hermosillo","America/Tijuana"],
    BR: ["America/Sao_Paulo","America/Noronha","America/Belem","America/Fortaleza","America/Recife","America/Araguaina","America/Maceio","America/Bahia","America/Campo_Grande","America/Cuiaba","America/Santarem","America/Porto_Velho","America/Boa_Vista","America/Manaus","America/Eirunepe","America/Rio_Branco"],
    AR: ["America/Argentina/Buenos_Aires","America/Argentina/Cordoba","America/Argentina/Salta","America/Argentina/Jujuy","America/Argentina/Tucuman","America/Argentina/Catamarca","America/Argentina/La_Rioja","America/Argentina/San_Juan","America/Argentina/Mendoza","America/Argentina/San_Luis","America/Argentina/Rio_Gallegos","America/Argentina/Ushuaia"],
    CL: ["America/Santiago","America/Punta_Arenas","Pacific/Easter"],
    CO: ["America/Bogota"], PE: ["America/Lima"], VE: ["America/Caracas"],
    EC: ["America/Guayaquil","Pacific/Galapagos"], BO: ["America/La_Paz"],
    PY: ["America/Asuncion"], UY: ["America/Montevideo"], GY: ["America/Guyana"],
    SR: ["America/Paramaribo"], GF: ["America/Cayenne"], CR: ["America/Costa_Rica"],
    PA: ["America/Panama"], GT: ["America/Guatemala"], HN: ["America/Tegucigalpa"],
    SV: ["America/El_Salvador"], NI: ["America/Managua"], BZ: ["America/Belize"],
    CU: ["America/Havana"], DO: ["America/Santo_Domingo"], PR: ["America/Puerto_Rico"],
    JM: ["America/Jamaica"], HT: ["America/Port-au-Prince"], TT: ["America/Port_of_Spain"],
    BB: ["America/Barbados"], BS: ["America/Nassau"],
    ZA: ["Africa/Johannesburg"], NG: ["Africa/Lagos"], KE: ["Africa/Nairobi"],
    GH: ["Africa/Accra"], TZ: ["Africa/Dar_es_Salaam"], UG: ["Africa/Kampala"],
    ET: ["Africa/Addis_Ababa"], EG: ["Africa/Cairo"], MA: ["Africa/Casablanca"],
    DZ: ["Africa/Algiers"], TN: ["Africa/Tunis"], LY: ["Africa/Tripoli"],
    SN: ["Africa/Dakar"], CI: ["Africa/Abidjan"], CM: ["Africa/Douala"],
    CD: ["Africa/Kinshasa","Africa/Lubumbashi"], AO: ["Africa/Luanda"],
    MZ: ["Africa/Maputo"], ZW: ["Africa/Harare"], ZM: ["Africa/Lusaka"],
    BW: ["Africa/Gaborone"], NA: ["Africa/Windhoek"], MW: ["Africa/Blantyre"],
    MG: ["Indian/Antananarivo"], MU: ["Indian/Mauritius"], RW: ["Africa/Kigali"],
    SD: ["Africa/Khartoum"], SO: ["Africa/Mogadishu"], ER: ["Africa/Asmara"],
    DJ: ["Africa/Djibouti"], BI: ["Africa/Bujumbura"],
    SA: ["Asia/Riyadh"], AE: ["Asia/Dubai"], QA: ["Asia/Qatar"], KW: ["Asia/Kuwait"],
    BH: ["Asia/Bahrain"], OM: ["Asia/Muscat"], YE: ["Asia/Aden"], IQ: ["Asia/Baghdad"],
    JO: ["Asia/Amman"], LB: ["Asia/Beirut"], SY: ["Asia/Damascus"], IL: ["Asia/Jerusalem"],
    PS: ["Asia/Hebron","Asia/Gaza"], IR: ["Asia/Tehran"], AF: ["Asia/Kabul"],
    CY: ["Asia/Nicosia","Asia/Famagusta"], IS: ["Atlantic/Reykjavik"],
    GL: ["America/Nuuk","America/Danmarkshavn","America/Scoresbysund","America/Thule"],
    FO: ["Atlantic/Faroe"], MT: ["Europe/Malta"], LU: ["Europe/Luxembourg"],
    AD: ["Europe/Andorra"], MC: ["Europe/Monaco"], SM: ["Europe/San_Marino"],
    GI: ["Europe/Gibraltar"], BT: ["Asia/Thimphu"], MV: ["Indian/Maldives"],
    BN: ["Asia/Brunei"], TL: ["Asia/Dili"],
  };

  // Friendly timezone labels for the banner
  const TZ_LABELS = {
    "America/New_York": "Eastern", "America/Chicago": "Central",
    "America/Denver": "Mountain", "America/Los_Angeles": "Pacific",
    "America/Phoenix": "Arizona (MST)", "America/Anchorage": "Alaska",
    "Pacific/Honolulu": "Hawaii", "America/Indiana/Indianapolis": "Eastern (Indiana)",
    "America/Boise": "Mountain", "America/Toronto": "Eastern (Canada)",
    "America/Vancouver": "Pacific (Canada)", "America/Edmonton": "Mountain (Canada)",
    "America/Winnipeg": "Central (Canada)", "America/Halifax": "Atlantic (Canada)",
    "America/St_Johns": "Newfoundland (Canada)", "America/Regina": "Central (Saskatchewan)",
  };

  function getTzLabel(tz) {
    return TZ_LABELS[tz] || tz.split("/").pop().replace(/_/g, " ");
  }

  // Parse phone number and return { callingCode, areaCode, digits }
  function parsePhone(phone) {
    if (!phone || !phone.startsWith("+")) return null;
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 4) return null;

    // Check +1 first
    if (digits.startsWith("1") && digits.length >= 4) {
      const areaCode = digits.substring(1, 4);
      return { callingCode: "1", areaCode, digits };
    }

    // Try 3-digit, 2-digit, 1-digit international codes
    for (const len of [3, 2, 1]) {
      const code = digits.substring(0, len);
      if (CALLING_CODE_TO_COUNTRIES[code]) {
        return { callingCode: code, areaCode: null, digits };
      }
    }
    return null;
  }

  // Get valid timezones based on phone number
  function getValidTimezones(parsed) {
    // +1: use area code if available
    if (parsed.callingCode === "1" && parsed.areaCode) {
      if (TOLL_FREE.has(parsed.areaCode)) return null; // skip toll-free
      const acTzs = AREA_CODE_TO_TIMEZONES[parsed.areaCode];
      if (acTzs) return new Set(acTzs);
      // Unknown area code: don't flag
      return null;
    }

    // International: use country-level mapping
    const countries = CALLING_CODE_TO_COUNTRIES[parsed.callingCode];
    if (!countries) return null;
    const tzSet = new Set();
    for (const cc of countries) {
      const tzs = COUNTRY_TO_TIMEZONES[cc];
      if (tzs) tzs.forEach((tz) => tzSet.add(tz));
    }
    return tzSet.size > 0 ? tzSet : null;
  }

  // Build a human-readable label for the phone's expected region
  function getPhoneLabel(parsed) {
    if (parsed.callingCode === "1" && parsed.areaCode) {
      const tzs = AREA_CODE_TO_TIMEZONES[parsed.areaCode];
      if (tzs) {
        const labels = tzs.map(getTzLabel);
        return `+1 (${parsed.areaCode}) — ${labels.join(" / ")}`;
      }
      return `+1 (${parsed.areaCode})`;
    }
    const countries = CALLING_CODE_TO_COUNTRIES[parsed.callingCode];
    if (!countries) return `+${parsed.callingCode}`;
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    const names = countries.slice(0, 3).map((cc) => {
      try { return regionNames.of(cc); } catch { return cc; }
    });
    if (countries.length > 3) names.push("...");
    return `+${parsed.callingCode} (${names.join(", ")})`;
  }

  function showBanner(message) {
    let banner = document.getElementById(BANNER_ID);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = BANNER_ID;
      Object.assign(banner.style, {
        position: "fixed",
        top: "12px",
        left: "12px",
        zIndex: "999999",
        background: "#dc2626",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: "8px",
        fontSize: "14px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontWeight: "500",
        lineHeight: "1.4",
        maxWidth: "420px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      });
      document.body.appendChild(banner);
    }
    banner.textContent = message;
    banner.style.display = "block";
  }

  function hideBanner() {
    const banner = document.getElementById(BANNER_ID);
    if (banner) banner.style.display = "none";
    clearHighlights();
  }

  const HIGHLIGHT_STYLE = "3px solid #dc2626";
  const HIGHLIGHT_ATTR = "data-throxy-tz-highlight";

  function clearHighlights() {
    document.querySelectorAll(`[${HIGHLIGHT_ATTR}]`).forEach((el) => {
      el.style.outline = el.getAttribute(HIGHLIGHT_ATTR);
      el.removeAttribute(HIGHLIGHT_ATTR);
    });
  }

  function highlightElement(el) {
    if (!el || el.hasAttribute(HIGHLIGHT_ATTR)) return;
    el.setAttribute(HIGHLIGHT_ATTR, el.style.outline || "");
    el.style.outline = HIGHLIGHT_STYLE;
  }

  function highlightPhoneField() {
    // Highlight the phone input's visible container
    const phoneInput = document.querySelector(
      'input[name="phone"], input[type="tel"], .PhoneInputInput'
    );
    if (phoneInput) {
      // Highlight the wrapper div (the styled container with the flag)
      const container = phoneInput.closest('[data-fob-field-name="phone"]')
        || phoneInput.closest(".PhoneInput")
        || phoneInput.parentElement;
      highlightElement(container || phoneInput);
    }
  }

  function highlightTimezoneField() {
    // Highlight timezone combobox/container
    const combobox = document.querySelector(".current-timezone");
    if (combobox) { highlightElement(combobox); return; }

    const tzButton = document.querySelector("[data-testid='timezone']");
    if (tzButton) { highlightElement(tzButton); return; }

    // On booking details page: find the element showing the IANA timezone text
    const allElements = document.querySelectorAll("p, span, div, li, button, a");
    for (const el of allElements) {
      if (el.children.length > 3) continue;
      const text = el.textContent.trim();
      if (/^[A-Z][a-z]+(?:\/[A-Za-z_]+){1,3}$/.test(text)) {
        highlightElement(el.closest("li") || el.parentElement || el);
        return;
      }
    }
  }

  function getSelectedTimezone() {
    // 1. Combobox on timezone picker page
    const combobox = document.querySelector(".current-timezone input[role='combobox']");
    if (combobox?.value) return combobox.value;

    // 2. data-testid timezone element
    const tzButton = document.querySelector("[data-testid='timezone']");
    if (tzButton?.textContent) {
      const m = tzButton.textContent.match(/[A-Z][a-z]+\/[A-Za-z_\/-]+/);
      if (m) return m[0];
    }

    // 3. .current-timezone container
    const tzEl = document.querySelector(".current-timezone");
    if (tzEl?.textContent) {
      const m = tzEl.textContent.match(/[A-Z][a-z]+\/[A-Za-z_\/-]+/);
      if (m) return m[0];
    }

    // 4. Booking details page: timezone shown as text anywhere on the page
    //    Look for IANA timezone pattern near globe/clock icons or in the sidebar
    const allElements = document.querySelectorAll("p, span, div, li, button, a");
    for (const el of allElements) {
      // Only check leaf-ish elements (avoid matching huge containers)
      if (el.children.length > 3) continue;
      const text = el.textContent.trim();
      // Match IANA timezone pattern like "Europe/London", "America/New_York"
      const m = text.match(/^([A-Z][a-z]+(?:\/[A-Za-z_]+){1,3})$/);
      if (m) return m[1];
    }

    // 5. Last resort: search full page text for timezone pattern
    const bodyText = document.body?.innerText || "";
    const tzMatch = bodyText.match(/(?:Africa|America|Antarctica|Arctic|Asia|Atlantic|Australia|Europe|Indian|Pacific)\/[A-Za-z_]+(?:\/[A-Za-z_]+)*/);
    if (tzMatch) return tzMatch[0];

    return null;
  }

  function getPhoneValue() {
    // Try multiple selectors for different cal.com form implementations
    const selectors = [
      'input[name="phone"]',
      'input[type="tel"]',
      '.PhoneInputInput',
      'input.PhoneInputInput',
      '[data-fob-field-name="phone"] input',
      'input[placeholder*="phone" i]',
      'input[id*="phone" i]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el?.value && el.value.length > 3) return el.value;
    }

    // Also check for hidden inputs that react-phone-number-input uses
    // to store the full E.164 value
    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    for (const input of hiddenInputs) {
      if (input.value && input.value.startsWith("+") && input.value.length >= 5) {
        return input.value;
      }
    }

    return null;
  }

  function check() {
    const phone = getPhoneValue();
    const tz = getSelectedTimezone();

    if (!phone || phone.length < 5 || !tz) {
      hideBanner();
      return;
    }

    const parsed = parsePhone(phone);
    if (!parsed) { hideBanner(); return; }

    const validTzs = getValidTimezones(parsed);
    if (!validTzs) { hideBanner(); return; }

    // Check if selected timezone matches any valid one
    const normalizedTz = tz.replace(/\s/g, "");
    let match = false;
    for (const validTz of validTzs) {
      if (
        normalizedTz === validTz ||
        normalizedTz.endsWith("/" + validTz.split("/").pop())
      ) {
        match = true;
        break;
      }
    }

    if (!match) {
      const phoneLabel = getPhoneLabel(parsed);
      showBanner(
        `⚠ Timezone mismatch: phone ${phoneLabel} but timezone is ${getTzLabel(tz)} (${tz}). Please verify the timezone is correct.`
      );
      highlightPhoneField();
      highlightTimezoneField();
    } else {
      hideBanner();
    }
  }

  setInterval(check, 1000);

  document.addEventListener("input", (e) => {
    if (
      e.target.matches &&
      (e.target.matches('input[name="phone"]') ||
        e.target.matches('input[type="tel"]') ||
        e.target.matches(".PhoneInputInput"))
    ) {
      setTimeout(check, 200);
    }
  }, true);

  const observer = new MutationObserver(() => {
    setTimeout(check, 300);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
