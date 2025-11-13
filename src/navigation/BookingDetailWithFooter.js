// BookingDetailWithFooter.js
import React, { useEffect, useState } from 'react';
import BookingDetailScreen from '../screens/SupporterService/BookingDetailsScreen'
import withFooter from '../components/withFooter'; // đường dẫn ví dụ
import userService from '../services/userService';

export default function BookingDetailWithFooter(props) {
  const [role, setRole] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await userService.getUser();
        if (!cancelled && res?.success) {
          setRole(res.data?.role || null);
        }
      } catch (e) {
        if (!cancelled) setRole(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Loading nhẹ hoặc return null để màn không giật
  if (!role) return null;

  const Wrapped =
    role === 'elderly'
      ? withFooter(BookingDetailScreen, 'plan')
      : role === 'family'
      ? withFooter(BookingDetailScreen, 'planFamily')
      : BookingDetailScreen; // fallback nếu role khác

  return <Wrapped {...props} />;
}
