import { services } from '@/core/services';
import { musicFor, type Mood } from '@/sim/cues';

/** Picks the music for the island: day or night, and the battle theme while monsters are on the hero. */
export class MusicDirector {
  private mood: Mood | null = null;

  /** Call every frame; the track only changes when the mood does. */
  update(night: boolean, fighting: boolean): void {
    const mood = musicFor(night, fighting);
    if (mood === this.mood) return;
    this.mood = mood;
    services.audio?.playMusic(mood, 1200);
  }
}
