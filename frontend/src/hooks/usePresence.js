import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  emitAvailabilityUpdate,
  onUserAvailability,
  onUserOnline,
  onUserOffline,
  getSocket,
} from '@/services/socket';

export function usePresence(userId) {
  const [presence, setPresence] = useState({ isOnline: false, availability: 'offline', lastSeen: null });
  const qc = useQueryClient();

  useEffect(() => {
    const unsubOnline = onUserOnline((uid, availability) => {
      if (uid === userId) {
        setPresence((p) => ({ ...p, isOnline: true, availability }));
        qc.invalidateQueries({ queryKey: ['full-profile', userId] });
      }
    });

    const unsubOffline = onUserOffline((uid, lastSeen) => {
      if (uid === userId) {
        setPresence((p) => ({ ...p, isOnline: false, availability: 'offline', lastSeen }));
        qc.invalidateQueries({ queryKey: ['full-profile', userId] });
      }
    });

    const unsubAvailability = onUserAvailability((uid, availability) => {
      if (uid === userId) {
        setPresence((p) => ({ ...p, availability }));
      }
    });

    return () => {
      unsubOnline();
      unsubOffline();
      unsubAvailability();
    };
  }, [userId, qc]);

  const updateAvailability = useCallback((status, nextAvailableDate) => {
    emitAvailabilityUpdate(status, nextAvailableDate);
    setPresence((p) => ({ ...p, availability: status }));
  }, []);

  return { presence, updateAvailability };
}

export function usePresenceMulti(userIds = []) {
  const [presenceMap, setPresenceMap] = useState({});
  const qc = useQueryClient();

  useEffect(() => {
    const unsubOnline = onUserOnline((uid, availability) => {
      setPresenceMap((prev) => ({
        ...prev,
        [uid]: { isOnline: true, availability, lastSeen: null },
      }));
    });

    const unsubOffline = onUserOffline((uid, lastSeen) => {
      setPresenceMap((prev) => ({
        ...prev,
        [uid]: { isOnline: false, availability: 'offline', lastSeen },
      }));
    });

    const unsubAvailability = onUserAvailability((uid, availability) => {
      setPresenceMap((prev) => ({
        ...prev,
        [uid]: { ...prev[uid], availability },
      }));
    });

    return () => {
      unsubOnline();
      unsubOffline();
      unsubAvailability();
    };
  }, []);

  return presenceMap;
}
