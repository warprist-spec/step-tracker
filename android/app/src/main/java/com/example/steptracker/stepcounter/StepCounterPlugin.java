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
        long rawSteps = prefs.getLong("raw_steps", 0);
        long baseline = prefs.getLong("baseline", -1);
        long today = 0;

        if (baseline == -1) {
            prefs.edit().putLong("baseline", rawSteps).apply();
        } else {
            today = Math.max(0, rawSteps - baseline);
        }

        JSObject ret = new JSObject();
        ret.put("steps", today);
        call.resolve(ret);
    }
}