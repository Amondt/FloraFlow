import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, AuthError, Session, User } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
  );

  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session;
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

  async signOut(): Promise<{ error: AuthError | null }> {
    const { error } = await this.client.auth.signOut();
    return { error };
  }
}
