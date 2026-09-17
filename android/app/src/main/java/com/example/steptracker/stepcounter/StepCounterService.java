package com.example.steptracker.stepcounter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

public class StepCounterService extends Service implements SensorEventListener {
    private SensorManager sensorManager;
    private Sensor stepSensor;
    private SharedPreferences prefs;

    @Override
    public void onCreate() {
        super.onCreate();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        prefs = getSharedPreferences("StepCounterPrefs", MODE_PRIVATE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, "step_channel")
                .setContentTitle("Шагомер работает")
                .setContentText("Делаем шаги на встречу здоровью")
                .setSmallIcon(android.R.drawable.ic_menu_compass)
                .build();
        startForeground(1, notification);

        if (stepSensor != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI);
        }
        return START_STICKY;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;

        long currentRaw = (long) event.values[0];
        long lastRaw = prefs.getLong("lastRawSteps", -1);

        // Первый запуск — просто запоминаем
        if (lastRaw < 0) {
            prefs.edit().putLong("lastRawSteps", currentRaw).apply();
            return;
        }

        // Ребут телефона — счётчик сбросился, не считаем дельту
        if (currentRaw < lastRaw) {
            prefs.edit().putLong("lastRawSteps", currentRaw).apply();
            return;
        }

        long delta = currentRaw - lastRaw;
        if (delta <= 0) return;

        // Определяем сегодняшнюю дату
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String bucketKey = "bucket_" + today;
        long currentBucket = prefs.getLong(bucketKey, 0);

        prefs.edit()
                .putLong(bucketKey, currentBucket + delta)
                .putLong("lastRawSteps", currentRaw)
                .apply();
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (sensorManager != null) sensorManager.unregisterListener(this);
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    "step_channel", "Step Counter", NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }
}