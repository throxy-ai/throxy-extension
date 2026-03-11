// Cal.com Phone ↔ Timezone Mismatch Warning
// Flags when the phone country code doesn't match the selected timezone

(function () {
  "use strict";

  const BANNER_ID = "throxy-tz-mismatch-banner";

  // Calling code → list of ISO country codes
  // For shared codes like +1, includes all countries
  const CALLING_CODE_TO_COUNTRIES = {
    "1": ["US","CA","PR","VI","GU","AS","MP","AG","AI","BB","BM","BS","DM","DO","GD","JM","KN","KY","LC","MS","SX","TC","TT","VC","VG"],
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
    US: ["America/New_York","America/Chicago","America/Denver","America/Los_Angeles","America/Anchorage","America/Adak","America/Phoenix","America/Boise","America/Indiana/Indianapolis","America/Indiana/Knox","America/Indiana/Marengo","America/Indiana/Petersburg","America/Indiana/Tell_City","America/Indiana/Vevay","America/Indiana/Vincennes","America/Indiana/Winamac","America/Kentucky/Louisville","America/Kentucky/Monticello","America/Menominee","America/Nome","America/North_Dakota/Beulah","America/North_Dakota/Center","America/North_Dakota/New_Salem","America/Sitka","America/Yakutat","America/Juneau","America/Metlakatla","Pacific/Honolulu"],
    CA: ["America/Toronto","America/Vancouver","America/Edmonton","America/Winnipeg","America/Halifax","America/St_Johns","America/Regina","America/Moncton","America/Thunder_Bay","America/Nipigon","America/Rainy_River","America/Atikokan","America/Yellowknife","America/Dawson","America/Whitehorse","America/Dawson_Creek","America/Fort_Nelson","America/Creston","America/Pangnirtung","America/Iqaluit","America/Resolute","America/Rankin_Inlet","America/Cambridge_Bay","America/Swift_Current","America/Goose_Bay","America/Glace_Bay","America/Blanc-Sablon","America/Inuvik"],
    GB: ["Europe/London"],
    IE: ["Europe/Dublin"],
    FR: ["Europe/Paris"],
    DE: ["Europe/Berlin"],
    ES: ["Europe/Madrid","Atlantic/Canary"],
    PT: ["Europe/Lisbon","Atlantic/Madeira","Atlantic/Azores"],
    IT: ["Europe/Rome"],
    NL: ["Europe/Amsterdam"],
    BE: ["Europe/Brussels"],
    CH: ["Europe/Zurich"],
    AT: ["Europe/Vienna"],
    SE: ["Europe/Stockholm"],
    NO: ["Europe/Oslo"],
    DK: ["Europe/Copenhagen"],
    FI: ["Europe/Helsinki"],
    PL: ["Europe/Warsaw"],
    CZ: ["Europe/Prague"],
    SK: ["Europe/Bratislava"],
    HU: ["Europe/Budapest"],
    RO: ["Europe/Bucharest"],
    BG: ["Europe/Sofia"],
    GR: ["Europe/Athens"],
    TR: ["Europe/Istanbul"],
    RU: ["Europe/Moscow","Europe/Kaliningrad","Europe/Samara","Europe/Volgograd","Asia/Yekaterinburg","Asia/Omsk","Asia/Novosibirsk","Asia/Barnaul","Asia/Tomsk","Asia/Novokuznetsk","Asia/Krasnoyarsk","Asia/Irkutsk","Asia/Chita","Asia/Yakutsk","Asia/Khandyga","Asia/Vladivostok","Asia/Ust-Nera","Asia/Magadan","Asia/Sakhalin","Asia/Srednekolymsk","Asia/Kamchatka","Asia/Anadyr","Europe/Kirov","Europe/Astrakhan","Europe/Ulyanovsk","Europe/Saratov"],
    UA: ["Europe/Kiev","Europe/Kyiv"],
    BY: ["Europe/Minsk"],
    LT: ["Europe/Vilnius"],
    LV: ["Europe/Riga"],
    EE: ["Europe/Tallinn"],
    HR: ["Europe/Zagreb"],
    SI: ["Europe/Ljubljana"],
    RS: ["Europe/Belgrade"],
    BA: ["Europe/Sarajevo"],
    ME: ["Europe/Podgorica"],
    MK: ["Europe/Skopje"],
    AL: ["Europe/Tirane"],
    MD: ["Europe/Chisinau"],
    AM: ["Asia/Yerevan"],
    GE: ["Asia/Tbilisi"],
    AZ: ["Asia/Baku"],
    KZ: ["Asia/Almaty","Asia/Aqtau","Asia/Aqtobe","Asia/Atyrau","Asia/Oral","Asia/Qostanay","Asia/Qyzylorda"],
    UZ: ["Asia/Tashkent","Asia/Samarkand"],
    TJ: ["Asia/Dushanbe"],
    TM: ["Asia/Ashgabat"],
    KG: ["Asia/Bishkek"],
    IN: ["Asia/Kolkata","Asia/Calcutta"],
    PK: ["Asia/Karachi"],
    BD: ["Asia/Dhaka"],
    LK: ["Asia/Colombo"],
    NP: ["Asia/Kathmandu"],
    MM: ["Asia/Yangon","Asia/Rangoon"],
    TH: ["Asia/Bangkok"],
    VN: ["Asia/Ho_Chi_Minh","Asia/Saigon"],
    KH: ["Asia/Phnom_Penh"],
    LA: ["Asia/Vientiane"],
    MY: ["Asia/Kuala_Lumpur","Asia/Kuching"],
    SG: ["Asia/Singapore"],
    ID: ["Asia/Jakarta","Asia/Pontianak","Asia/Makassar","Asia/Jayapura"],
    PH: ["Asia/Manila"],
    CN: ["Asia/Shanghai","Asia/Urumqi"],
    HK: ["Asia/Hong_Kong"],
    MO: ["Asia/Macau"],
    TW: ["Asia/Taipei"],
    JP: ["Asia/Tokyo"],
    KR: ["Asia/Seoul"],
    KP: ["Asia/Pyongyang"],
    MN: ["Asia/Ulaanbaatar","Asia/Hovd","Asia/Choibalsan"],
    AU: ["Australia/Sydney","Australia/Melbourne","Australia/Brisbane","Australia/Perth","Australia/Adelaide","Australia/Hobart","Australia/Darwin","Australia/Currie","Australia/Lindeman","Australia/Lord_Howe","Australia/Eucla","Australia/Broken_Hill","Antarctica/Macquarie"],
    NZ: ["Pacific/Auckland","Pacific/Chatham"],
    FJ: ["Pacific/Fiji"],
    PG: ["Pacific/Port_Moresby","Pacific/Bougainville"],
    SB: ["Pacific/Guadalcanal"],
    NC: ["Pacific/Noumea"],
    VU: ["Pacific/Efate"],
    WS: ["Pacific/Apia"],
    TO: ["Pacific/Tongatapu"],
    KI: ["Pacific/Tarawa","Pacific/Kanton","Pacific/Kiritimati"],
    MH: ["Pacific/Majuro","Pacific/Kwajalein"],
    FM: ["Pacific/Chuuk","Pacific/Pohnpei","Pacific/Kosrae"],
    PW: ["Pacific/Palau"],
    NR: ["Pacific/Nauru"],
    TV: ["Pacific/Funafuti"],
    CK: ["Pacific/Rarotonga"],
    PF: ["Pacific/Tahiti","Pacific/Marquesas","Pacific/Gambier"],
    MX: ["America/Mexico_City","America/Cancun","America/Merida","America/Monterrey","America/Matamoros","America/Chihuahua","America/Ciudad_Juarez","America/Ojinaga","America/Mazatlan","America/Bahia_Banderas","America/Hermosillo","America/Tijuana"],
    BR: ["America/Sao_Paulo","America/Noronha","America/Belem","America/Fortaleza","America/Recife","America/Araguaina","America/Maceio","America/Bahia","America/Campo_Grande","America/Cuiaba","America/Santarem","America/Porto_Velho","America/Boa_Vista","America/Manaus","America/Eirunepe","America/Rio_Branco"],
    AR: ["America/Argentina/Buenos_Aires","America/Argentina/Cordoba","America/Argentina/Salta","America/Argentina/Jujuy","America/Argentina/Tucuman","America/Argentina/Catamarca","America/Argentina/La_Rioja","America/Argentina/San_Juan","America/Argentina/Mendoza","America/Argentina/San_Luis","America/Argentina/Rio_Gallegos","America/Argentina/Ushuaia"],
    CL: ["America/Santiago","America/Punta_Arenas","Pacific/Easter"],
    CO: ["America/Bogota"],
    PE: ["America/Lima"],
    VE: ["America/Caracas"],
    EC: ["America/Guayaquil","Pacific/Galapagos"],
    BO: ["America/La_Paz"],
    PY: ["America/Asuncion"],
    UY: ["America/Montevideo"],
    GY: ["America/Guyana"],
    SR: ["America/Paramaribo"],
    GF: ["America/Cayenne"],
    CR: ["America/Costa_Rica"],
    PA: ["America/Panama"],
    GT: ["America/Guatemala"],
    HN: ["America/Tegucigalpa"],
    SV: ["America/El_Salvador"],
    NI: ["America/Managua"],
    BZ: ["America/Belize"],
    CU: ["America/Havana"],
    DO: ["America/Santo_Domingo"],
    PR: ["America/Puerto_Rico"],
    JM: ["America/Jamaica"],
    HT: ["America/Port-au-Prince"],
    TT: ["America/Port_of_Spain"],
    BB: ["America/Barbados"],
    BS: ["America/Nassau"],
    ZA: ["Africa/Johannesburg"],
    NG: ["Africa/Lagos"],
    KE: ["Africa/Nairobi"],
    GH: ["Africa/Accra"],
    TZ: ["Africa/Dar_es_Salaam"],
    UG: ["Africa/Kampala"],
    ET: ["Africa/Addis_Ababa"],
    EG: ["Africa/Cairo"],
    MA: ["Africa/Casablanca"],
    DZ: ["Africa/Algiers"],
    TN: ["Africa/Tunis"],
    LY: ["Africa/Tripoli"],
    SN: ["Africa/Dakar"],
    CI: ["Africa/Abidjan"],
    CM: ["Africa/Douala"],
    CD: ["Africa/Kinshasa","Africa/Lubumbashi"],
    AO: ["Africa/Luanda"],
    MZ: ["Africa/Maputo"],
    ZW: ["Africa/Harare"],
    ZM: ["Africa/Lusaka"],
    BW: ["Africa/Gaborone"],
    NA: ["Africa/Windhoek"],
    MW: ["Africa/Blantyre"],
    MG: ["Indian/Antananarivo"],
    MU: ["Indian/Mauritius"],
    RW: ["Africa/Kigali"],
    SD: ["Africa/Khartoum"],
    SO: ["Africa/Mogadishu"],
    ER: ["Africa/Asmara"],
    DJ: ["Africa/Djibouti"],
    BI: ["Africa/Bujumbura"],
    SA: ["Asia/Riyadh"],
    AE: ["Asia/Dubai"],
    QA: ["Asia/Qatar"],
    KW: ["Asia/Kuwait"],
    BH: ["Asia/Bahrain"],
    OM: ["Asia/Muscat"],
    YE: ["Asia/Aden"],
    IQ: ["Asia/Baghdad"],
    JO: ["Asia/Amman"],
    LB: ["Asia/Beirut"],
    SY: ["Asia/Damascus"],
    IL: ["Asia/Jerusalem"],
    PS: ["Asia/Hebron","Asia/Gaza"],
    IR: ["Asia/Tehran"],
    AF: ["Asia/Kabul"],
    CY: ["Asia/Nicosia","Asia/Famagusta"],
    IS: ["Atlantic/Reykjavik"],
    GL: ["America/Nuuk","America/Danmarkshavn","America/Scoresbysund","America/Thule"],
    FO: ["Atlantic/Faroe"],
    MT: ["Europe/Malta"],
    LU: ["Europe/Luxembourg"],
    AD: ["Europe/Andorra"],
    MC: ["Europe/Monaco"],
    SM: ["Europe/San_Marino"],
    GI: ["Europe/Gibraltar"],
    BT: ["Asia/Thimphu"],
    MV: ["Indian/Maldives"],
    BN: ["Asia/Brunei"],
    TL: ["Asia/Dili"],
    // US territories
    GU: ["Pacific/Guam"],
    AS: ["Pacific/Pago_Pago"],
    VI: ["America/Virgin"],
    MP: ["Pacific/Guam"],
    // Caribbean +1 countries
    AG: ["America/Antigua"],
    AI: ["America/Anguilla"],
    BM: ["Atlantic/Bermuda"],
    DM: ["America/Dominica"],
    GD: ["America/Grenada"],
    KN: ["America/St_Kitts"],
    KY: ["America/Cayman"],
    LC: ["America/St_Lucia"],
    MS: ["America/Montserrat"],
    TC: ["America/Grand_Turk"],
    VC: ["America/St_Vincent"],
    VG: ["America/Tortola"],
    SX: ["America/Lower_Princes"],
  };

  // Extract calling code from E.164 phone number
  function getCallingCode(phone) {
    if (!phone || !phone.startsWith("+")) return null;
    const digits = phone.replace(/[^0-9]/g, "");
    // Try 3-digit, then 2-digit, then 1-digit codes
    for (const len of [3, 2, 1]) {
      const code = digits.substring(0, len);
      if (CALLING_CODE_TO_COUNTRIES[code]) return code;
    }
    return null;
  }

  // Get all valid timezones for a calling code
  function getValidTimezones(callingCode) {
    const countries = CALLING_CODE_TO_COUNTRIES[callingCode];
    if (!countries) return null;
    const tzSet = new Set();
    for (const cc of countries) {
      const tzs = COUNTRY_TO_TIMEZONES[cc];
      if (tzs) tzs.forEach((tz) => tzSet.add(tz));
    }
    return tzSet.size > 0 ? tzSet : null;
  }

  // Get country names for display
  function getCountryNames(callingCode) {
    const countries = CALLING_CODE_TO_COUNTRIES[callingCode];
    if (!countries) return "";
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    // Show max 3 country names to keep banner short
    const names = countries.slice(0, 3).map((cc) => {
      try { return regionNames.of(cc); } catch { return cc; }
    });
    if (countries.length > 3) names.push("...");
    return names.join(", ");
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
        maxWidth: "380px",
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
  }

  // Read the selected timezone from cal.com UI
  function getSelectedTimezone() {
    // Primary: combobox inside .current-timezone
    const combobox = document.querySelector(".current-timezone input[role='combobox']");
    if (combobox?.value) return combobox.value;

    // Fallback: button text in timezone selector
    const tzButton = document.querySelector("[data-testid='timezone']");
    if (tzButton?.textContent) return tzButton.textContent.trim();

    // Fallback: any element with timezone-like text
    const tzEl = document.querySelector(".current-timezone");
    if (tzEl?.textContent) {
      const match = tzEl.textContent.match(/[A-Z][a-z]+\/[A-Za-z_\/-]+/);
      if (match) return match[0];
    }

    return null;
  }

  // Read the phone number from the form
  function getPhoneValue() {
    // react-phone-number-input stores full E.164 in a hidden input
    const phoneInput = document.querySelector(
      'input[name="phone"], input[type="tel"], .PhoneInputInput'
    );
    if (phoneInput?.value) return phoneInput.value;
    return null;
  }

  function check() {
    const phone = getPhoneValue();
    const tz = getSelectedTimezone();

    if (!phone || phone.length < 4 || !tz) {
      hideBanner();
      return;
    }

    const callingCode = getCallingCode(phone);
    if (!callingCode) {
      hideBanner();
      return;
    }

    const validTzs = getValidTimezones(callingCode);
    if (!validTzs) {
      hideBanner();
      return;
    }

    // Normalize: check if selected tz matches any valid one
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
      const countries = getCountryNames(callingCode);
      showBanner(
        `⚠ Timezone mismatch: phone is +${callingCode} (${countries}) but timezone is ${tz}. Please verify the timezone is correct.`
      );
    } else {
      hideBanner();
    }
  }

  // Run check on input changes and periodically
  setInterval(check, 1000);

  // Also listen for input events on phone fields
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

  // Observe DOM for SPA navigation
  const observer = new MutationObserver(() => {
    setTimeout(check, 300);
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
