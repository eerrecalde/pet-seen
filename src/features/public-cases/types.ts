export type PublicCase = {
  public_slug: string
  title: string | null
  last_seen_at: string | null
  last_seen_description: string | null
  pet_name: string
  species: 'dog' | 'cat'
  breed: string | null
  colour: string | null
  pet_description: string | null
  public_latitude: number
  public_longitude: number
}

export type NearbyCase = Pick<
  PublicCase,
  | 'public_slug'
  | 'pet_name'
  | 'species'
  | 'breed'
  | 'colour'
  | 'last_seen_description'
  | 'public_latitude'
  | 'public_longitude'
> & {
  published_at: string
}

export type NearbySighting = {
  sighting_id: string
  public_latitude: number
  public_longitude: number
}

export type PublicCaseOption = Pick<
  PublicCase,
  | 'public_slug'
  | 'pet_name'
  | 'species'
  | 'breed'
  | 'colour'
  | 'last_seen_description'
>

export type ShareChannel = 'copy' | 'web_share' | 'whatsapp' | 'poster'
export type ContentReportReason = 'incorrect' | 'harmful' | 'scam' | 'other'
