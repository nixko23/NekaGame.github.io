import type { InternalTrack } from '../recommendation/types'

export interface TrackSearchProvider {
  search(query: string, signal?: AbortSignal): Promise<InternalTrack[]>
}
