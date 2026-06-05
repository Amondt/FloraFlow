import { Injectable, inject, signal } from '@angular/core';
import type { Database } from '../../../types/database.types';
import { SupabaseService } from './supabase.service';

type Profile = Database['public']['Tables']['profiles']['Row'];

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);

  private readonly _profile = signal<Profile | null>(null);
  readonly profile = this._profile.asReadonly();

  readonly profileReady: Promise<void>;

  constructor() {
    let resolve!: () => void;
    this.profileReady = new Promise<void>((r) => (resolve = r));

    void this.supabase.sessionReady.then(async () => {
      const session = this.supabase.session();
      if (session) {
        const { data, error } = await this.supabase.client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (error) {
          console.error('ProfileService: failed to load profile', error.message);
        } else {
          this._profile.set(data);
        }
      }
      resolve();
    });
  }

  async setLocation(lat: number, lon: number, locationName: string): Promise<void> {
    const userId = this.supabase.session()?.user.id;
    if (!userId) return;

    const { error } = await this.supabase.client
      .from('profiles')
      .update({ latitude: lat, longitude: lon, location_name: locationName })
      .eq('id', userId);

    if (error) throw error;

    await this._refreshProfile(userId);
  }

  async clearLocation(): Promise<void> {
    const userId = this.supabase.session()?.user.id;
    if (!userId) return;

    const { error } = await this.supabase.client
      .from('profiles')
      .update({ latitude: null, longitude: null, location_name: null })
      .eq('id', userId);

    if (error) throw error;

    await this._refreshProfile(userId);
  }

  async completeOnboarding(): Promise<void> {
    const userId = this.supabase.session()?.user.id;
    if (!userId) return;

    const { error } = await this.supabase.client
      .from('profiles')
      .update({ has_completed_onboarding: true })
      .eq('id', userId);

    if (error) throw error;

    await this._refreshProfile(userId);
  }

  // Load the profile for the currently authenticated user if it has not
  // already been fetched for this session. Called by guards that run after
  // a login that happened post-startup (profileReady was already settled).
  async loadProfileForCurrentSession(): Promise<void> {
    const userId = this.supabase.session()?.user.id;
    if (!userId) return;
    if (this._profile()?.id === userId) return;

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('ProfileService: failed to load profile', error.message);
    } else {
      this._profile.set(data);
    }
  }

  private async _refreshProfile(userId: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) this._profile.set(data);
  }
}
