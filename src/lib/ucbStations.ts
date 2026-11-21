export type UcbStation = {
  id: string;
  name: string;
  detail: string;
  province: string;
  stream: string;
};

/**
 * UCB Radio Canada's public Icecast feeds. Every feed sends
 * Access-Control-Allow-Origin: *, so the audio element can stay in CORS mode
 * and its signal can be read by a Web Audio AnalyserNode.
 */
export const UCB_STATIONS: UcbStation[] = [
  {
    id: 'ucbradio',
    name: 'UCB Radio',
    detail: 'National feed',
    province: 'Canada',
    stream: 'https://ucbmedia.streamguys1.com/ucbradio-icy',
  },
  {
    id: 'ucbworship',
    name: 'UCB Worship',
    detail: 'Worship feed',
    province: 'Canada',
    stream: 'https://ucbmedia.streamguys1.com/ucbworship-icy',
  },
  {
    id: 'ckos911',
    name: 'Fort McMurray',
    detail: 'CKOS 91.1',
    province: 'Alberta',
    stream: 'https://ucbmedia.streamguys1.com/fmac911-icy',
  },
  {
    id: 'cjlt937',
    name: 'Medicine Hat',
    detail: 'CJLT 93.7',
    province: 'Alberta',
    stream: 'https://ucbmedia.streamguys1.com/mhat937-icy',
  },
  {
    id: 'cfih',
    name: 'Kelowna',
    detail: 'UCB 88.1',
    province: 'British Columbia',
    stream: 'https://ucbmedia.streamguys1.com/kelo881-icy',
  },
  {
    id: 'ckjj1035',
    name: 'Bancroft',
    detail: 'CKJJ 103.5',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/bell1023-icy',
  },
  {
    id: 'ckjj1023',
    name: 'Belleville',
    detail: 'CKJJ 102.3',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/bell1023-icy',
  },
  {
    id: 'ckjj999',
    name: 'Brockville',
    detail: 'CKJJ 99.9',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/bell1023-icy',
  },
  {
    id: 'ckgw893',
    name: 'Chatham-Kent',
    detail: 'CKGW 89.3',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/chat893-icy',
  },
  {
    id: 'chjj907',
    name: 'Cobourg',
    detail: 'CHJJ 90.7',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/cobo907-icy',
  },
  {
    id: 'ckjj1005',
    name: 'Kingston',
    detail: 'CKJJ 100.5',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/bell1023-icy',
  },
  {
    id: 'ckjj947',
    name: 'Maynooth',
    detail: 'CKJJ 94.7',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/bell1023-icy',
  },
  {
    id: 'cjoa925',
    name: 'Nipigon',
    detail: 'CJOA 92.5',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/tbay951-icy',
  },
  {
    id: 'cjoa951',
    name: 'Thunder Bay',
    detail: 'CJOA 95.1',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/tbay951-icy',
  },
  {
    id: 'cjah905',
    name: 'Windsor',
    detail: 'CJAH 90.5',
    province: 'Ontario',
    stream: 'https://ucbmedia.streamguys1.com/wind905-icy',
  },
  {
    id: 'ciuc959',
    name: 'Regina',
    detail: 'CIUC 95.9',
    province: 'Saskatchewan',
    stream: 'https://ucbmedia.streamguys1.com/regi959-icy',
  },
  {
    id: 'cihx1031',
    name: 'Saskatoon',
    detail: 'CIHX 103.1',
    province: 'Saskatchewan',
    stream: 'https://ucbmedia.streamguys1.com/sask1031-icy',
  },
];

export const DEFAULT_UCB_STATION_ID = UCB_STATIONS[0].id;

export const UCB_STATION_GROUPS = [
  'Canada',
  'Alberta',
  'British Columbia',
  'Ontario',
  'Saskatchewan',
].map(province => ({
  label: province === 'Canada' ? 'National' : province,
  province,
  stations: UCB_STATIONS.filter(station => station.province === province),
}));

export const findUcbStation = (id: string) =>
  UCB_STATIONS.find(station => station.id === id);
