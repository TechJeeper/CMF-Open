package com.cmfkit.appstore

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(SyncPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
