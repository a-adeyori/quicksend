import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function MoneyInRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace({ pathname: '/transactions', params: { filter: 'in' } }); }, []);
  return null;
}
