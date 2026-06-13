import { Injectable, signal } from '@angular/core';
import { createClient, SupabaseClient, AuthError, Session, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseKey);

  private readonly _session = signal<Session | null | undefined>(undefined);
  readonly session = this._session.asReadonly();

  readonly sessionReady: Promise<void>;

  constructor() {
    let onFirst!: () => void;
    this.sessionReady = new Promise((resolve) => {
      onFirst = resolve;
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      onFirst();
    });
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  async getAuthToken(): Promise<string | null> {
    const session = await this.getSession();
    return session?.access_token ?? null;
  }

  async getUser(): Promise<User | null> {
    const { data } = await this.client.auth.getUser();
    return data.user;
  }

  async signInWithPassword(
    email: string,
    password: string,
  ): Promise<{ session: Session | null; error: AuthError | null }> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    return { session: data.session, error };
  }

  async signUp(
    email: string,
    password: string,
  ): Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    const needsEmailConfirmation = !error && !!data.user && data.session === null;
    return { error, needsEmailConfirmation };
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await this.client.auth.signOut();
    return { error };
  }
}
