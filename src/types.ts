export interface Track {
  id: string
  title: string
  artist: string
  genre?: string
  image?: string
  duration?: number
  plays?: number
  isFavorite: boolean
  sourceUrl?: string
  sourceName?: string
  playbackId?: string
  playbackAvailable?: boolean
  playbackUnavailableReason?: string
  album?: string
  releaseDate?: string
}

export interface Playlist {
  id: string
  name: string
  description: string
  trackCount: number
  image: string
  tracks: Track[]
}
