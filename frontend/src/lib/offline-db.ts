export interface OfflineCheckinItem {
  id?: number;
  checkinId: string;
  payload: {
    message: string;
    latitude?: number;
    longitude?: number;
    selfieUrl?: string;
    clientCapturedAt: string;
    timezone: string;
    deviceIdHash: string;
    offlineEventId: string;
    offlineSequence: number;
    previousEventHash: string | null;
    payloadHash: string;
    accuracyMeters?: number;
    syncStatus: 'OFFLINE' | 'SYNCING' | 'SYNCED' | 'FAILED';
  };
}

class OfflineDB {
  private dbName = 'PresenceFlow_OfflineDB';
  private storeName = 'offline_checkins';
  private version = 1;

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('IndexedDB is only available in browser.'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Generate SHA-256 hash using browser SubtleCrypto
  async hashPayload(content: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (err) {
      // Fallback simple hash string if crypto is not supported in non-secure HTTP contexts
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return 'fallback_hash_' + Math.abs(hash).toString(16);
    }
  }

  async getQueue(): Promise<OfflineCheckinItem[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async addToQueue(checkinId: string, message: string, extra: {
    latitude?: number;
    longitude?: number;
    selfieUrl?: string;
    accuracyMeters?: number;
  }): Promise<OfflineCheckinItem> {
    const queue = await this.getQueue();
    
    // Determine sequence and previous hash
    const lastItem = queue.length > 0 ? queue[queue.length - 1] : null;
    const offlineSequence = lastItem ? lastItem.payload.offlineSequence + 1 : 1;
    const previousEventHash = lastItem ? lastItem.payload.payloadHash : null;

    const offlineEventId = typeof crypto.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : 'offline_evt_' + Math.random().toString(36).substring(2, 15);

    const clientCapturedAt = new Date().toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

    // Simplified stable device fingerprint
    const deviceIdHash = await this.hashPayload(
      navigator.userAgent + (navigator.language || 'pt-BR')
    );

    const rawPayloadString = JSON.stringify({
      checkinId,
      message,
      latitude: extra.latitude,
      longitude: extra.longitude,
      selfieUrl: extra.selfieUrl,
      clientCapturedAt,
      offlineEventId,
      offlineSequence
    });

    const payloadHash = await this.hashPayload(rawPayloadString);

    const item: OfflineCheckinItem = {
      checkinId,
      payload: {
        message,
        latitude: extra.latitude,
        longitude: extra.longitude,
        selfieUrl: extra.selfieUrl,
        clientCapturedAt,
        timezone,
        deviceIdHash,
        offlineEventId,
        offlineSequence,
        previousEventHash,
        payloadHash,
        accuracyMeters: extra.accuracyMeters,
        syncStatus: 'OFFLINE'
      }
    };

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(item);

      request.onsuccess = () => {
        item.id = request.result as number;
        resolve(item);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async removeItem(id: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async clearQueue(): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

export const offlineDB = new OfflineDB();
