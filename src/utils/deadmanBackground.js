import notifee, { EventType } from '@notifee/react-native';
import deadmanService from '../services/deadmanService';


notifee.onBackgroundEvent(async ({ type, detail }) => {
  try {
    if (type === EventType.ACTION_PRESS) {
      const id = detail?.pressAction?.id;
      if (id === 'deadman_ok_today') {
        await deadmanService.checkin();
      } else if (id === 'deadman_snooze_60') {
        await deadmanService.snooze?.({ minutes: 60 });
      }
    }
  } catch (e) {
    console.warn('Deadman background handler error:', e.message);
  }
});
