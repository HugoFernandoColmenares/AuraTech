import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '@core/services/supabase/supabase.service';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';
import { shouldUseMockAuth } from '@core/auxiliar/auth-offline.util';
import {
  AVATAR_STORAGE_BUCKET,
  optimizeImageForAvatar,
} from '@core/auxiliar/avatar-image.util';

const MOCK_AVATAR_KEY = 'auratech_mock_avatar';

@Injectable({ providedIn: 'root' })
export class AvatarStorageService {
  private readonly supabase = inject(SupabaseService);
  private readonly env = inject(EnvConfig);
  private readonly health = inject(HealthService);

  async uploadAvatar(userId: string, file: File): Promise<string> {
    const optimized = await optimizeImageForAvatar(file);
    const ext = optimized.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${userId}/avatar.${ext}`;

    if (shouldUseMockAuth(this.env, this.health)) {
      const dataUrl = await blobToDataUrl(optimized);
      localStorage.setItem(`${MOCK_AVATAR_KEY}_${userId}`, dataUrl);
      return dataUrl;
    }

    const client = this.supabase.getClient();
    if (!client) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await client.storage
      .from(AVATAR_STORAGE_BUCKET)
      .upload(path, optimized, {
        upsert: true,
        contentType: optimized.type,
        cacheControl: '3600',
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = client.storage.from(AVATAR_STORAGE_BUCKET).getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  getMockAvatar(userId: string): string | null {
    return localStorage.getItem(`${MOCK_AVATAR_KEY}_${userId}`);
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.readAsDataURL(blob);
  });
}
