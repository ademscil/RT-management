import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export class LocalNotificationManager {
  private static isAvailable = Capacitor.isPluginAvailable('LocalNotifications');

  public static async requestPermissions(): Promise<boolean> {
    if (!this.isAvailable) return false;
    try {
      const status = await LocalNotifications.requestPermissions();
      return status.display === 'granted';
    } catch {
      return false;
    }
  }

  public static async scheduleRondaAlarm(options: {
    scheduleId: number;
    tanggalRonda: string;
    jamMulai: string;
    posRonda: string;
  }): Promise<void> {
    if (!this.isAvailable) {
      console.log('[LocalNotification Fallback] Ronda alarm scheduled:', options);
      return;
    }

    try {
      // Alarm 30 minutes before ronda
      const [year, month, day] = options.tanggalRonda.split('-').map(Number);
      const [hour, minute] = options.jamMulai.split(':').map(Number);
      const scheduleTime = new Date(year, month - 1, day, hour, minute);
      scheduleTime.setMinutes(scheduleTime.getMinutes() - 30);

      if (scheduleTime.getTime() > Date.now()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: options.scheduleId,
              title: 'Jadwal Ronda Siskamling Warga',
              body: `Pengingat: 30 menit lagi giliran jaga ronda Anda di ${options.posRonda}. Harap berkumpul tepat waktu.`,
              schedule: { at: scheduleTime },
              sound: 'beep.wav',
              actionTypeId: 'RONDA_ALERT',
              extra: { type: 'RONDA', scheduleId: options.scheduleId },
            },
          ],
        });
      }
    } catch (err) {
      console.warn('Failed to schedule ronda alarm:', err);
    }
  }

  public static async scheduleIuranReminder(options: {
    billId: number;
    bulan: string;
    nominal: number;
    dueDate: Date;
  }): Promise<void> {
    if (!this.isAvailable) {
      console.log('[LocalNotification Fallback] Iuran reminder scheduled:', options);
      return;
    }

    try {
      const reminderTime = new Date(options.dueDate.getTime());
      reminderTime.setDate(reminderTime.getDate() - 2); // 2 days before

      if (reminderTime.getTime() > Date.now()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 100000 + options.billId,
              title: 'Jatuh Tempo Iuran RT',
              body: `Iuran ${options.bulan} sebesar Rp ${options.nominal.toLocaleString('id-ID')} jatuh tempo dalam 2 hari.`,
              schedule: { at: reminderTime },
              sound: 'beep.wav',
              actionTypeId: 'IURAN_ALERT',
              extra: { type: 'IURAN', billId: options.billId },
            },
          ],
        });
      }
    } catch (err) {
      console.warn('Failed to schedule iuran reminder:', err);
    }
  }

  public static async sendInstantNotification(title: string, body: string): Promise<void> {
    if (!this.isAvailable) {
      console.log('[LocalNotification Fallback] Instant notification:', { title, body });
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 100000),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) },
          },
        ],
      });
    } catch (err) {
      console.warn('Failed to send instant notification:', err);
    }
  }
}
