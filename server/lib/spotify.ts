// SpotifyClient stub - simplified build does not include Spotify cover art features
// Kept as no-op stub to satisfy import sites.

export class SpotifyClient {
  constructor(_opts: { id: string; secret: string }) {}
  async getCoverArt(_artist: string, _track: string): Promise<string> {
    return '';
  }
}