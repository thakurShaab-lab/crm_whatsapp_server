// Exact port of legacy `get_isd_from_mobile()` from helper.php, including its
// last-match-wins behavior: it checks the longest prefix (4 digits) down to the
// shortest (1 digit) without breaking on a match, so a shorter prefix match found
// later in the loop deliberately overrides a longer one found earlier (this is how
// the legacy code resolves e.g. NANP numbers, whose real code is the single digit '1').
const ISD_CODES = [
  '93', '335', '213', '684', '376', '244', '264', '672', '268', '54', '374', '297', '61', '43', '994', '242', '973',
  '880', '246', '375', '32', '501', '229', '441', '975', '591', '387', '267', '47', '55', '246', '673', '359', '226',
  '257', '855', '237', '1', '238', '345', '236', '235', '56', '86', '61', '61', '57', '269', '242', '682', '506',
  '225', '385', '53', '357', '420', '45', '253', '767', '809', '670', '593', '20', '503', '240', '291', '372', '251',
  '500', '298', '679', '358', '33', '590', '594', '689', '590', '241', '220', '995', '49', '233', '350', '30', '299',
  '809', '590', '1', '502', '224', '245', '592', '509', '61', '504', '852', '36', '354', '91', '62', '98', '964',
  '353', '972', '39', '876', '81', '962', '7', '254', '686', '850', '82', '965', '7', '856', '371', '961', '266',
  '231', '218', '423', '370', '352', '853', '389', '261', '265', '60', '960', '223', '356', '692', '596', '222',
  '230', '269', '52', '691', '373', '377', '976', '664', '212', '258', '95', '264', '674', '977', '31', '599', '687',
  '64', '505', '227', '234', '683', '672', '670', '47', '968', '92', '680', '507', '675', '595', '51', '63', '872',
  '48', '787', '974', '262', '40', '7', '250', '869', '758', '784', '685', '378', '239', '966', '221', '248', '232',
  '65', '421', '386', '677', '252', '27', '44', '34', '94', '290', '508', '249', '597', '47', '268', '46', '41',
  '963', '886', '7', '255', '66', '228', '64', '676', '868', '216', '90', '993', '649', '688', '256', '380', '971',
  '44', '598', '7', '678', '39', '58', '84', '1', '681', '212', '967', '381', '243', '260', '263', '351', '218', '970',
]

export function getIsdFromMobile(mobile) {
  let isdCode = ''
  for (let i = 4; i >= 1; i--) {
    const prefix = mobile.slice(0, i)
    if (ISD_CODES.includes(prefix)) {
      isdCode = prefix
    }
  }
  return isdCode
}

// Standard ISO 3166-1 alpha-2 country code -> ITU calling code. Legacy calls this
// mapping `get_country_id_only_isocode()`; its source wasn't available in any of the
// PHP files provided, but this is standardized public data (not proprietary business
// logic), used to resolve AiSensy's `contacts[0].user_id` field (e.g. "IN.9198...",
// where "IN" is the ISO2 code, not a numeric ISD code — the two were previously
// conflated, which crashed inbound-message inserts with an invalid `country_code`).
const ISO2_TO_ISD = {
  AF: '93', AL: '355', DZ: '213', AS: '1684', AD: '376', AO: '244', AI: '1264', AG: '1268', AR: '54', AM: '374',
  AW: '297', AU: '61', AT: '43', AZ: '994', BS: '1242', BH: '973', BD: '880', BB: '1246', BY: '375', BE: '32',
  BZ: '501', BJ: '229', BM: '1441', BT: '975', BO: '591', BA: '387', BW: '267', BR: '55', IO: '246', BN: '673',
  BG: '359', BF: '226', BI: '257', KH: '855', CM: '237', CA: '1', CV: '238', KY: '1345', CF: '236', TD: '235',
  CL: '56', CN: '86', CX: '61', CC: '61', CO: '57', KM: '269', CG: '242', CK: '682', CR: '506', CI: '225',
  HR: '385', CU: '53', CY: '357', CZ: '420', DK: '45', DJ: '253', DM: '1767', DO: '1809', EC: '593', EG: '20',
  SV: '503', GQ: '240', ER: '291', EE: '372', ET: '251', FK: '500', FO: '298', FJ: '679', FI: '358', FR: '33',
  GF: '594', PF: '689', GA: '241', GM: '220', GE: '995', DE: '49', GH: '233', GI: '350', GR: '30', GL: '299',
  GD: '1473', GP: '590', GU: '1671', GT: '502', GN: '224', GW: '245', GY: '592', HT: '509', HN: '504', HK: '852',
  HU: '36', IS: '354', IN: '91', ID: '62', IR: '98', IQ: '964', IE: '353', IL: '972', IT: '39', JM: '1876',
  JP: '81', JO: '962', KZ: '7', KE: '254', KI: '686', KP: '850', KR: '82', KW: '965', KG: '996', LA: '856',
  LV: '371', LB: '961', LS: '266', LR: '231', LY: '218', LI: '423', LT: '370', LU: '352', MO: '853', MK: '389',
  MG: '261', MW: '265', MY: '60', MV: '960', ML: '223', MT: '356', MH: '692', MQ: '596', MR: '222', MU: '230',
  YT: '262', MX: '52', FM: '691', MD: '373', MC: '377', MN: '976', MS: '1664', MA: '212', MZ: '258', MM: '95',
  NA: '264', NR: '674', NP: '977', NL: '31', AN: '599', NC: '687', NZ: '64', NI: '505', NE: '227', NG: '234',
  NU: '683', NF: '672', MP: '1670', NO: '47', OM: '968', PK: '92', PW: '680', PA: '507', PG: '675', PY: '595',
  PE: '51', PH: '63', PN: '870', PL: '48', PT: '351', PR: '1787', QA: '974', RE: '262', RO: '40', RU: '7',
  RW: '250', SH: '290', KN: '1869', LC: '1758', PM: '508', VC: '1784', WS: '685', SM: '378', ST: '239', SA: '966',
  SN: '221', RS: '381', SC: '248', SL: '232', SG: '65', SK: '421', SI: '386', SB: '677', SO: '252', ZA: '27',
  ES: '34', LK: '94', SD: '249', SR: '597', SZ: '268', SE: '46', CH: '41', SY: '963', TW: '886', TJ: '992',
  TZ: '255', TH: '66', TG: '228', TK: '690', TO: '676', TT: '1868', TN: '216', TR: '90', TM: '993', TC: '1649',
  TV: '688', UG: '256', UA: '380', AE: '971', GB: '44', US: '1', UY: '598', UZ: '998', VU: '678', VA: '39',
  VE: '58', VN: '84', VG: '1284', VI: '1340', WF: '681', EH: '212', YE: '967', ZM: '260', ZW: '263', AX: '358',
  BQ: '599', CW: '599', GG: '44', IM: '44', JE: '44', ME: '382', BL: '590', MF: '590', SX: '1721', SS: '211',
  XK: '383',
}

/** Resolves the numeric ISD calling code from a WhatsApp `user_id`-style ISO2 prefix (e.g. "IN.9198..." -> "91"). */
export function getIsdFromIso2(iso2) {
  return ISO2_TO_ISD[iso2?.toUpperCase()] || ''
}
