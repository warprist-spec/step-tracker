package com.example.steptracker.stepcounter;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

@CapacitorPlugin(name = "StepCounter")
public class StepCounterPlugin extends Plugin {
    private SharedPreferences prefs;

    @Override
    public void load() {
        prefs = getContext().getSharedPreferences("StepCounterPrefs", Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Intent intent = new Intent(getContext(), StepCounterService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        long steps = prefs.getLong("bucket_" + today, 0);

        JSObject ret = new JSObject();
        ret.put("steps", steps);
        call.resolve(ret);
    }

    @PluginMethod
    public void getHistory(PluginCall call) {
        int days = call.getInt("days", 7);

        JSObject ret = new JSObject();
        JSObject history = new JSObject();

        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        Calendar cal = Calendar.getInstance();

        for (int i = 0; i < days; i++) {
            String key = "bucket_" + fmt.format(cal.getTime());
            long steps = prefs.getLong(key, 0);
            history.put(fmt.format(cal.getTime()), steps);
            cal.add(Calendar.DAY_OF_MONTH, -1);
        }

        ret.put("history", history);
        call.resolve(ret);
    }

    @PluginMethod
    public void setManualSteps(PluginCall call) {
        String date = call.getString("date");
        Integer steps = call.getInt("steps");

        if (date == null || steps == null) {
            call.reject("date и steps обязательны");
            return;
        }

        prefs.edit().putLong("bucket_" + date, steps.longValue()).apply();
        call.resolve();
    }

    @PluginMethod
    public void resetToday(PluginCall call) {
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        long currentRaw = prefs.getLong("lastRawSteps", 0);

        // Обнуляем бакет сегодня и сбрасываем "последнее сырое"
        // к текущему, чтобы следующая дельта шла с нуля
        prefs.edit()
                .putLong("bucket_" + today, 0)
                .apply();

        call.resolve();
    }
}