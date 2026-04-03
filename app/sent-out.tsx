import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function SentOutRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace({ pathname: '/transactions', params: { filter: 'out' } }); }, []);
  return null;
}
