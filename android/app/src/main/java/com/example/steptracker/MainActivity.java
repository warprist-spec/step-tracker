package com.example.steptracker;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.example.steptracker.stepcounter.StepCounterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StepCounterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}