import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useSessionStore } from '../src/features/auth/sessionStore';
import { getSetting } from '../src/db/repositories/transactionRepo';

export default function Index() {
  const { isAuthenticated, setRole, setAuthenticated } = useSessionStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const pinEnabled = getSetting('pin_enabled') === '1';
    if (!pinEnabled && !isAuthenticated) {
      // PIN disabled → auto-login as owner
      setRole('owner');
      setAuthenticated(true);
    }
    setChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!checked) return null;

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/pin" />;
  }

  return <Redirect href="/(tabs)/pos" />;
}
