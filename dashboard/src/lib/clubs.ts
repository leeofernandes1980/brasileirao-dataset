// Mapeamento de clubes → ID ESPN + cor oficial
// Logo: /logos/espn-{id}.png  (servido como arquivo estático)

export interface ClubInfo {
  espnId: number | null  // null = sem logo mapeado (usa fallback de iniciais)
  color:  string
}

const CLUBS: Record<string, ClubInfo> = {
  'Flamengo':        { espnId: 819,    color: '#E22B2B' },
  'Palmeiras':       { espnId: 2029,   color: '#006B3F' },
  'Corinthians':     { espnId: 874,    color: '#1A1A1A' },
  'Sao Paulo':       { espnId: 2026,   color: '#CC0000' },
  'Santos':          { espnId: 2674,   color: '#1A1A1A' },
  'Atletico-MG':     { espnId: 7632,   color: '#1A1A1A' },
  'Fluminense':      { espnId: 3445,   color: '#8B1538' },
  'Internacional':   { espnId: 1936,   color: '#CC0000' },
  'Gremio':          { espnId: 6273,   color: '#0B3FA0' },
  'Cruzeiro':        { espnId: 2022,   color: '#0D2699' },
  'Vasco':           { espnId: 3454,   color: '#1A1A1A' },
  'Botafogo-RJ':     { espnId: 6086,   color: '#1A1A1A' },
  'Athletico-PR':    { espnId: 3458,   color: '#CC0000' },
  'Fortaleza':       { espnId: 6272,   color: '#0033A0' },
  'Bahia':           { espnId: 9967,   color: '#0000CC' },
  'Ceara':           { espnId: 9969,   color: '#1A1A1A' },
  'Sport':           { espnId: 7635,   color: '#C8102E' },
  'Chapecoense':     { espnId: 9318,   color: '#007A33' },
  'Juventude':       { espnId: 6270,   color: '#006400' },
  'Avai':            { espnId: 9966,   color: '#0047AB' },
  'Goias':           { espnId: 3395,   color: '#007A33' },
  'Coritiba':        { espnId: 3456,   color: '#007A33' },
  'Nautico':         { espnId: 7633,   color: '#CC0000' },
  'Guarani':         { espnId: 3448,   color: '#006400' },
  'Ponte Preta':     { espnId: 3459,   color: '#1A1A1A' },
  'Criciuma':        { espnId: 9971,   color: '#FFD700' },
  'Portuguesa':      { espnId: null,   color: '#CC0000' },
  'America-MG':      { espnId: 6154,   color: '#006400' },
  'Figueirense':     { espnId: 3461,   color: '#1A1A1A' },
  'Santa Cruz':      { espnId: 4929,   color: '#CC0000' },
  'Parana':          { espnId: null,   color: '#4169E1' },
  'Paysandu':        { espnId: 15424,  color: '#0000CC' },
  'Vitoria':         { espnId: 3457,   color: '#CC0000' },
  'CSA':             { espnId: null,   color: '#0047AB' },
  'Bragantino':      { espnId: 6079,   color: '#CC0000' },
  'Cuiaba':          { espnId: 17313,  color: '#FFB800' },
  'Remo':            { espnId: 4936,   color: '#0047AB' },
  'Mirassol':        { espnId: 9169,   color: '#FFD700' },
  'America-RN':      { espnId: null,   color: '#CC0000' },
  'Joinville':       { espnId: null,   color: '#0047AB' },
  'Ipatinga':        { espnId: null,   color: '#CC0000' },
  'Brasiliense':     { espnId: null,   color: '#FFD700' },
  'Sao Caetano':     { espnId: null,   color: '#0047AB' },
  'Santo Andre':     { espnId: null,   color: '#CC0000' },
  'Barueri':         { espnId: null,   color: '#1A1A1A' },
  'Gremio Prudente': { espnId: null,   color: '#006400' },
}

export function getClubInfo(name: string): ClubInfo {
  return CLUBS[name] ?? { espnId: null, color: '#3d7cf5' }
}

export function getClubColor(name: string): string {
  return getClubInfo(name).color
}

export function getCrestUrl(name: string): string | null {
  const { espnId } = getClubInfo(name)
  return espnId ? `/logos/espn-${espnId}.png` : null
}
